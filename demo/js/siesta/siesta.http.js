(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/***** xregexp.js *****/

/*!
 * XRegExp v2.0.0
 * (c) 2007-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 */

/**
 * XRegExp provides augmented, extensible JavaScript regular expressions. You get new syntax,
 * flags, and methods beyond what browsers support natively. XRegExp is also a regex utility belt
 * with tools to make your client-side grepping simpler and more powerful, while freeing you from
 * worrying about pesky cross-browser inconsistencies and the dubious `lastIndex` property. See
 * XRegExp's documentation (http://xregexp.com/) for more details.
 * @module xregexp
 * @requires N/A
 */
var XRegExp;

// Avoid running twice; that would reset tokens and could break references to native globals
XRegExp = XRegExp || (function (undef) {
    "use strict";

/*--------------------------------------
 *  Private variables
 *------------------------------------*/

    var self,
        addToken,
        add,

// Optional features; can be installed and uninstalled
        features = {
            natives: false,
            extensibility: false
        },

// Store native methods to use and restore ("native" is an ES3 reserved keyword)
        nativ = {
            exec: RegExp.prototype.exec,
            test: RegExp.prototype.test,
            match: String.prototype.match,
            replace: String.prototype.replace,
            split: String.prototype.split
        },

// Storage for fixed/extended native methods
        fixed = {},

// Storage for cached regexes
        cache = {},

// Storage for addon tokens
        tokens = [],

// Token scopes
        defaultScope = "default",
        classScope = "class",

// Regexes that match native regex syntax
        nativeTokens = {
            // Any native multicharacter token in default scope (includes octals, excludes character classes)
            "default": /^(?:\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S])|\(\?[:=!]|[?*+]\?|{\d+(?:,\d*)?}\??)/,
            // Any native multicharacter token in character class scope (includes octals)
            "class": /^(?:\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S]))/
        },

// Any backreference in replacement strings
        replacementToken = /\$(?:{([\w$]+)}|(\d\d?|[\s\S]))/g,

// Any character with a later instance in the string
        duplicateFlags = /([\s\S])(?=[\s\S]*\1)/g,

// Any greedy/lazy quantifier
        quantifier = /^(?:[?*+]|{\d+(?:,\d*)?})\??/,

// Check for correct `exec` handling of nonparticipating capturing groups
        compliantExecNpcg = nativ.exec.call(/()??/, "")[1] === undef,

// Check for flag y support (Firefox 3+)
        hasNativeY = RegExp.prototype.sticky !== undef,

// Used to kill infinite recursion during XRegExp construction
        isInsideConstructor = false,

// Storage for known flags, including addon flags
        registeredFlags = "gim" + (hasNativeY ? "y" : "");

/*--------------------------------------
 *  Private helper functions
 *------------------------------------*/

/**
 * Attaches XRegExp.prototype properties and named capture supporting data to a regex object.
 * @private
 * @param {RegExp} regex Regex to augment.
 * @param {Array} captureNames Array with capture names, or null.
 * @param {Boolean} [isNative] Whether the regex was created by `RegExp` rather than `XRegExp`.
 * @returns {RegExp} Augmented regex.
 */
    function augment(regex, captureNames, isNative) {
        var p;
        // Can't auto-inherit these since the XRegExp constructor returns a nonprimitive value
        for (p in self.prototype) {
            if (self.prototype.hasOwnProperty(p)) {
                regex[p] = self.prototype[p];
            }
        }
        regex.xregexp = {captureNames: captureNames, isNative: !!isNative};
        return regex;
    }

/**
 * Returns native `RegExp` flags used by a regex object.
 * @private
 * @param {RegExp} regex Regex to check.
 * @returns {String} Native flags in use.
 */
    function getNativeFlags(regex) {
        //return nativ.exec.call(/\/([a-z]*)$/i, String(regex))[1];
        return (regex.global     ? "g" : "") +
               (regex.ignoreCase ? "i" : "") +
               (regex.multiline  ? "m" : "") +
               (regex.extended   ? "x" : "") + // Proposed for ES6, included in AS3
               (regex.sticky     ? "y" : ""); // Proposed for ES6, included in Firefox 3+
    }

/**
 * Copies a regex object while preserving special properties for named capture and augmenting with
 * `XRegExp.prototype` methods. The copy has a fresh `lastIndex` property (set to zero). Allows
 * adding and removing flags while copying the regex.
 * @private
 * @param {RegExp} regex Regex to copy.
 * @param {String} [addFlags] Flags to be added while copying the regex.
 * @param {String} [removeFlags] Flags to be removed while copying the regex.
 * @returns {RegExp} Copy of the provided regex, possibly with modified flags.
 */
    function copy(regex, addFlags, removeFlags) {
        if (!self.isRegExp(regex)) {
            throw new TypeError("type RegExp expected");
        }
        var flags = nativ.replace.call(getNativeFlags(regex) + (addFlags || ""), duplicateFlags, "");
        if (removeFlags) {
            // Would need to escape `removeFlags` if this was public
            flags = nativ.replace.call(flags, new RegExp("[" + removeFlags + "]+", "g"), "");
        }
        if (regex.xregexp && !regex.xregexp.isNative) {
            // Compiling the current (rather than precompilation) source preserves the effects of nonnative source flags
            regex = augment(self(regex.source, flags),
                            regex.xregexp.captureNames ? regex.xregexp.captureNames.slice(0) : null);
        } else {
            // Augment with `XRegExp.prototype` methods, but use native `RegExp` (avoid searching for special tokens)
            regex = augment(new RegExp(regex.source, flags), null, true);
        }
        return regex;
    }

/*
 * Returns the last index at which a given value can be found in an array, or `-1` if it's not
 * present. The array is searched backwards.
 * @private
 * @param {Array} array Array to search.
 * @param {*} value Value to locate in the array.
 * @returns {Number} Last zero-based index at which the item is found, or -1.
 */
    function lastIndexOf(array, value) {
        var i = array.length;
        if (Array.prototype.lastIndexOf) {
            return array.lastIndexOf(value); // Use the native method if available
        }
        while (i--) {
            if (array[i] === value) {
                return i;
            }
        }
        return -1;
    }

/**
 * Determines whether an object is of the specified type.
 * @private
 * @param {*} value Object to check.
 * @param {String} type Type to check for, in lowercase.
 * @returns {Boolean} Whether the object matches the type.
 */
    function isType(value, type) {
        return Object.prototype.toString.call(value).toLowerCase() === "[object " + type + "]";
    }

/**
 * Prepares an options object from the given value.
 * @private
 * @param {String|Object} value Value to convert to an options object.
 * @returns {Object} Options object.
 */
    function prepareOptions(value) {
        value = value || {};
        if (value === "all" || value.all) {
            value = {natives: true, extensibility: true};
        } else if (isType(value, "string")) {
            value = self.forEach(value, /[^\s,]+/, function (m) {
                this[m] = true;
            }, {});
        }
        return value;
    }

/**
 * Runs built-in/custom tokens in reverse insertion order, until a match is found.
 * @private
 * @param {String} pattern Original pattern from which an XRegExp object is being built.
 * @param {Number} pos Position to search for tokens within `pattern`.
 * @param {Number} scope Current regex scope.
 * @param {Object} context Context object assigned to token handler functions.
 * @returns {Object} Object with properties `output` (the substitution string returned by the
 *   successful token handler) and `match` (the token's match array), or null.
 */
    function runTokens(pattern, pos, scope, context) {
        var i = tokens.length,
            result = null,
            match,
            t;
        // Protect against constructing XRegExps within token handler and trigger functions
        isInsideConstructor = true;
        // Must reset `isInsideConstructor`, even if a `trigger` or `handler` throws
        try {
            while (i--) { // Run in reverse order
                t = tokens[i];
                if ((t.scope === "all" || t.scope === scope) && (!t.trigger || t.trigger.call(context))) {
                    t.pattern.lastIndex = pos;
                    match = fixed.exec.call(t.pattern, pattern); // Fixed `exec` here allows use of named backreferences, etc.
                    if (match && match.index === pos) {
                        result = {
                            output: t.handler.call(context, match, scope),
                            match: match
                        };
                        break;
                    }
                }
            }
        } catch (err) {
            throw err;
        } finally {
            isInsideConstructor = false;
        }
        return result;
    }

/**
 * Enables or disables XRegExp syntax and flag extensibility.
 * @private
 * @param {Boolean} on `true` to enable; `false` to disable.
 */
    function setExtensibility(on) {
        self.addToken = addToken[on ? "on" : "off"];
        features.extensibility = on;
    }

/**
 * Enables or disables native method overrides.
 * @private
 * @param {Boolean} on `true` to enable; `false` to disable.
 */
    function setNatives(on) {
        RegExp.prototype.exec = (on ? fixed : nativ).exec;
        RegExp.prototype.test = (on ? fixed : nativ).test;
        String.prototype.match = (on ? fixed : nativ).match;
        String.prototype.replace = (on ? fixed : nativ).replace;
        String.prototype.split = (on ? fixed : nativ).split;
        features.natives = on;
    }

/*--------------------------------------
 *  Constructor
 *------------------------------------*/

/**
 * Creates an extended regular expression object for matching text with a pattern. Differs from a
 * native regular expression in that additional syntax and flags are supported. The returned object
 * is in fact a native `RegExp` and works with all native methods.
 * @class XRegExp
 * @constructor
 * @param {String|RegExp} pattern Regex pattern string, or an existing `RegExp` object to copy.
 * @param {String} [flags] Any combination of flags:
 *   <li>`g` - global
 *   <li>`i` - ignore case
 *   <li>`m` - multiline anchors
 *   <li>`n` - explicit capture
 *   <li>`s` - dot matches all (aka singleline)
 *   <li>`x` - free-spacing and line comments (aka extended)
 *   <li>`y` - sticky (Firefox 3+ only)
 *   Flags cannot be provided when constructing one `RegExp` from another.
 * @returns {RegExp} Extended regular expression object.
 * @example
 *
 * // With named capture and flag x
 * date = XRegExp('(?<year>  [0-9]{4}) -?  # year  \n\
 *                 (?<month> [0-9]{2}) -?  # month \n\
 *                 (?<day>   [0-9]{2})     # day   ', 'x');
 *
 * // Passing a regex object to copy it. The copy maintains special properties for named capture,
 * // is augmented with `XRegExp.prototype` methods, and has a fresh `lastIndex` property (set to
 * // zero). Native regexes are not recompiled using XRegExp syntax.
 * XRegExp(/regex/);
 */
    self = function (pattern, flags) {
        if (self.isRegExp(pattern)) {
            if (flags !== undef) {
                throw new TypeError("can't supply flags when constructing one RegExp from another");
            }
            return copy(pattern);
        }
        // Tokens become part of the regex construction process, so protect against infinite recursion
        // when an XRegExp is constructed within a token handler function
        if (isInsideConstructor) {
            throw new Error("can't call the XRegExp constructor within token definition functions");
        }

        var output = [],
            scope = defaultScope,
            tokenContext = {
                hasNamedCapture: false,
                captureNames: [],
                hasFlag: function (flag) {
                    return flags.indexOf(flag) > -1;
                }
            },
            pos = 0,
            tokenResult,
            match,
            chr;
        pattern = pattern === undef ? "" : String(pattern);
        flags = flags === undef ? "" : String(flags);

        if (nativ.match.call(flags, duplicateFlags)) { // Don't use test/exec because they would update lastIndex
            throw new SyntaxError("invalid duplicate regular expression flag");
        }
        // Strip/apply leading mode modifier with any combination of flags except g or y: (?imnsx)
        pattern = nativ.replace.call(pattern, /^\(\?([\w$]+)\)/, function ($0, $1) {
            if (nativ.test.call(/[gy]/, $1)) {
                throw new SyntaxError("can't use flag g or y in mode modifier");
            }
            flags = nativ.replace.call(flags + $1, duplicateFlags, "");
            return "";
        });
        self.forEach(flags, /[\s\S]/, function (m) {
            if (registeredFlags.indexOf(m[0]) < 0) {
                throw new SyntaxError("invalid regular expression flag " + m[0]);
            }
        });

        while (pos < pattern.length) {
            // Check for custom tokens at the current position
            tokenResult = runTokens(pattern, pos, scope, tokenContext);
            if (tokenResult) {
                output.push(tokenResult.output);
                pos += (tokenResult.match[0].length || 1);
            } else {
                // Check for native tokens (except character classes) at the current position
                match = nativ.exec.call(nativeTokens[scope], pattern.slice(pos));
                if (match) {
                    output.push(match[0]);
                    pos += match[0].length;
                } else {
                    chr = pattern.charAt(pos);
                    if (chr === "[") {
                        scope = classScope;
                    } else if (chr === "]") {
                        scope = defaultScope;
                    }
                    // Advance position by one character
                    output.push(chr);
                    ++pos;
                }
            }
        }

        return augment(new RegExp(output.join(""), nativ.replace.call(flags, /[^gimy]+/g, "")),
                       tokenContext.hasNamedCapture ? tokenContext.captureNames : null);
    };

/*--------------------------------------
 *  Public methods/properties
 *------------------------------------*/

// Installed and uninstalled states for `XRegExp.addToken`
    addToken = {
        on: function (regex, handler, options) {
            options = options || {};
            if (regex) {
                tokens.push({
                    pattern: copy(regex, "g" + (hasNativeY ? "y" : "")),
                    handler: handler,
                    scope: options.scope || defaultScope,
                    trigger: options.trigger || null
                });
            }
            // Providing `customFlags` with null `regex` and `handler` allows adding flags that do
            // nothing, but don't throw an error
            if (options.customFlags) {
                registeredFlags = nativ.replace.call(registeredFlags + options.customFlags, duplicateFlags, "");
            }
        },
        off: function () {
            throw new Error("extensibility must be installed before using addToken");
        }
    };

/**
 * Extends or changes XRegExp syntax and allows custom flags. This is used internally and can be
 * used to create XRegExp addons. `XRegExp.install('extensibility')` must be run before calling
 * this function, or an error is thrown. If more than one token can match the same string, the last
 * added wins.
 * @memberOf XRegExp
 * @param {RegExp} regex Regex object that matches the new token.
 * @param {Function} handler Function that returns a new pattern string (using native regex syntax)
 *   to replace the matched token within all future XRegExp regexes. Has access to persistent
 *   properties of the regex being built, through `this`. Invoked with two arguments:
 *   <li>The match array, with named backreference properties.
 *   <li>The regex scope where the match was found.
 * @param {Object} [options] Options object with optional properties:
 *   <li>`scope` {String} Scopes where the token applies: 'default', 'class', or 'all'.
 *   <li>`trigger` {Function} Function that returns `true` when the token should be applied; e.g.,
 *     if a flag is set. If `false` is returned, the matched string can be matched by other tokens.
 *     Has access to persistent properties of the regex being built, through `this` (including
 *     function `this.hasFlag`).
 *   <li>`customFlags` {String} Nonnative flags used by the token's handler or trigger functions.
 *     Prevents XRegExp from throwing an invalid flag error when the specified flags are used.
 * @example
 *
 * // Basic usage: Adds \a for ALERT character
 * XRegExp.addToken(
 *   /\\a/,
 *   function () {return '\\x07';},
 *   {scope: 'all'}
 * );
 * XRegExp('\\a[\\a-\\n]+').test('\x07\n\x07'); // -> true
 */
    self.addToken = addToken.off;

/**
 * Caches and returns the result of calling `XRegExp(pattern, flags)`. On any subsequent call with
 * the same pattern and flag combination, the cached copy is returned.
 * @memberOf XRegExp
 * @param {String} pattern Regex pattern string.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Cached XRegExp object.
 * @example
 *
 * while (match = XRegExp.cache('.', 'gs').exec(str)) {
 *   // The regex is compiled once only
 * }
 */
    self.cache = function (pattern, flags) {
        var key = pattern + "/" + (flags || "");
        return cache[key] || (cache[key] = self(pattern, flags));
    };

/**
 * Escapes any regular expression metacharacters, for use when matching literal strings. The result
 * can safely be used at any point within a regex that uses any flags.
 * @memberOf XRegExp
 * @param {String} str String to escape.
 * @returns {String} String with regex metacharacters escaped.
 * @example
 *
 * XRegExp.escape('Escaped? <.>');
 * // -> 'Escaped\?\ <\.>'
 */
    self.escape = function (str) {
        return nativ.replace.call(str, /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    };

/**
 * Executes a regex search in a specified string. Returns a match array or `null`. If the provided
 * regex uses named capture, named backreference properties are included on the match array.
 * Optional `pos` and `sticky` arguments specify the search start position, and whether the match
 * must start at the specified position only. The `lastIndex` property of the provided regex is not
 * used, but is updated for compatibility. Also fixes browser bugs compared to the native
 * `RegExp.prototype.exec` and can be used reliably cross-browser.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Number} [pos=0] Zero-based index at which to start the search.
 * @param {Boolean|String} [sticky=false] Whether the match must start at the specified position
 *   only. The string `'sticky'` is accepted as an alternative to `true`.
 * @returns {Array} Match array with named backreference properties, or null.
 * @example
 *
 * // Basic use, with named backreference
 * var match = XRegExp.exec('U+2620', XRegExp('U\\+(?<hex>[0-9A-F]{4})'));
 * match.hex; // -> '2620'
 *
 * // With pos and sticky, in a loop
 * var pos = 2, result = [], match;
 * while (match = XRegExp.exec('<1><2><3><4>5<6>', /<(\d)>/, pos, 'sticky')) {
 *   result.push(match[1]);
 *   pos = match.index + match[0].length;
 * }
 * // result -> ['2', '3', '4']
 */
    self.exec = function (str, regex, pos, sticky) {
        var r2 = copy(regex, "g" + (sticky && hasNativeY ? "y" : ""), (sticky === false ? "y" : "")),
            match;
        r2.lastIndex = pos = pos || 0;
        match = fixed.exec.call(r2, str); // Fixed `exec` required for `lastIndex` fix, etc.
        if (sticky && match && match.index !== pos) {
            match = null;
        }
        if (regex.global) {
            regex.lastIndex = match ? r2.lastIndex : 0;
        }
        return match;
    };

/**
 * Executes a provided function once per regex match.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Function} callback Function to execute for each match. Invoked with four arguments:
 *   <li>The match array, with named backreference properties.
 *   <li>The zero-based match index.
 *   <li>The string being traversed.
 *   <li>The regex object being used to traverse the string.
 * @param {*} [context] Object to use as `this` when executing `callback`.
 * @returns {*} Provided `context` object.
 * @example
 *
 * // Extracts every other digit from a string
 * XRegExp.forEach('1a2345', /\d/, function (match, i) {
 *   if (i % 2) this.push(+match[0]);
 * }, []);
 * // -> [2, 4]
 */
    self.forEach = function (str, regex, callback, context) {
        var pos = 0,
            i = -1,
            match;
        while ((match = self.exec(str, regex, pos))) {
            callback.call(context, match, ++i, str, regex);
            pos = match.index + (match[0].length || 1);
        }
        return context;
    };

/**
 * Copies a regex object and adds flag `g`. The copy maintains special properties for named
 * capture, is augmented with `XRegExp.prototype` methods, and has a fresh `lastIndex` property
 * (set to zero). Native regexes are not recompiled using XRegExp syntax.
 * @memberOf XRegExp
 * @param {RegExp} regex Regex to globalize.
 * @returns {RegExp} Copy of the provided regex with flag `g` added.
 * @example
 *
 * var globalCopy = XRegExp.globalize(/regex/);
 * globalCopy.global; // -> true
 */
    self.globalize = function (regex) {
        return copy(regex, "g");
    };

/**
 * Installs optional features according to the specified options.
 * @memberOf XRegExp
 * @param {Object|String} options Options object or string.
 * @example
 *
 * // With an options object
 * XRegExp.install({
 *   // Overrides native regex methods with fixed/extended versions that support named
 *   // backreferences and fix numerous cross-browser bugs
 *   natives: true,
 *
 *   // Enables extensibility of XRegExp syntax and flags
 *   extensibility: true
 * });
 *
 * // With an options string
 * XRegExp.install('natives extensibility');
 *
 * // Using a shortcut to install all optional features
 * XRegExp.install('all');
 */
    self.install = function (options) {
        options = prepareOptions(options);
        if (!features.natives && options.natives) {
            setNatives(true);
        }
        if (!features.extensibility && options.extensibility) {
            setExtensibility(true);
        }
    };

/**
 * Checks whether an individual optional feature is installed.
 * @memberOf XRegExp
 * @param {String} feature Name of the feature to check. One of:
 *   <li>`natives`
 *   <li>`extensibility`
 * @returns {Boolean} Whether the feature is installed.
 * @example
 *
 * XRegExp.isInstalled('natives');
 */
    self.isInstalled = function (feature) {
        return !!(features[feature]);
    };

/**
 * Returns `true` if an object is a regex; `false` if it isn't. This works correctly for regexes
 * created in another frame, when `instanceof` and `constructor` checks would fail.
 * @memberOf XRegExp
 * @param {*} value Object to check.
 * @returns {Boolean} Whether the object is a `RegExp` object.
 * @example
 *
 * XRegExp.isRegExp('string'); // -> false
 * XRegExp.isRegExp(/regex/i); // -> true
 * XRegExp.isRegExp(RegExp('^', 'm')); // -> true
 * XRegExp.isRegExp(XRegExp('(?s).')); // -> true
 */
    self.isRegExp = function (value) {
        return isType(value, "regexp");
    };

/**
 * Retrieves the matches from searching a string using a chain of regexes that successively search
 * within previous matches. The provided `chain` array can contain regexes and objects with `regex`
 * and `backref` properties. When a backreference is specified, the named or numbered backreference
 * is passed forward to the next regex or returned.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {Array} chain Regexes that each search for matches within preceding results.
 * @returns {Array} Matches by the last regex in the chain, or an empty array.
 * @example
 *
 * // Basic usage; matches numbers within <b> tags
 * XRegExp.matchChain('1 <b>2</b> 3 <b>4 a 56</b>', [
 *   XRegExp('(?is)<b>.*?</b>'),
 *   /\d+/
 * ]);
 * // -> ['2', '4', '56']
 *
 * // Passing forward and returning specific backreferences
 * html = '<a href="http://xregexp.com/api/">XRegExp</a>\
 *         <a href="http://www.google.com/">Google</a>';
 * XRegExp.matchChain(html, [
 *   {regex: /<a href="([^"]+)">/i, backref: 1},
 *   {regex: XRegExp('(?i)^https?://(?<domain>[^/?#]+)'), backref: 'domain'}
 * ]);
 * // -> ['xregexp.com', 'www.google.com']
 */
    self.matchChain = function (str, chain) {
        return (function recurseChain(values, level) {
            var item = chain[level].regex ? chain[level] : {regex: chain[level]},
                matches = [],
                addMatch = function (match) {
                    matches.push(item.backref ? (match[item.backref] || "") : match[0]);
                },
                i;
            for (i = 0; i < values.length; ++i) {
                self.forEach(values[i], item.regex, addMatch);
            }
            return ((level === chain.length - 1) || !matches.length) ?
                    matches :
                    recurseChain(matches, level + 1);
        }([str], 0));
    };

/**
 * Returns a new string with one or all matches of a pattern replaced. The pattern can be a string
 * or regex, and the replacement can be a string or a function to be called for each match. To
 * perform a global search and replace, use the optional `scope` argument or include flag `g` if
 * using a regex. Replacement strings can use `${n}` for named and numbered backreferences.
 * Replacement functions can use named backreferences via `arguments[0].name`. Also fixes browser
 * bugs compared to the native `String.prototype.replace` and can be used reliably cross-browser.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp|String} search Search pattern to be replaced.
 * @param {String|Function} replacement Replacement string or a function invoked to create it.
 *   Replacement strings can include special replacement syntax:
 *     <li>$$ - Inserts a literal '$'.
 *     <li>$&, $0 - Inserts the matched substring.
 *     <li>$` - Inserts the string that precedes the matched substring (left context).
 *     <li>$' - Inserts the string that follows the matched substring (right context).
 *     <li>$n, $nn - Where n/nn are digits referencing an existent capturing group, inserts
 *       backreference n/nn.
 *     <li>${n} - Where n is a name or any number of digits that reference an existent capturing
 *       group, inserts backreference n.
 *   Replacement functions are invoked with three or more arguments:
 *     <li>The matched substring (corresponds to $& above). Named backreferences are accessible as
 *       properties of this first argument.
 *     <li>0..n arguments, one for each backreference (corresponding to $1, $2, etc. above).
 *     <li>The zero-based index of the match within the total search string.
 *     <li>The total string being searched.
 * @param {String} [scope='one'] Use 'one' to replace the first match only, or 'all'. If not
 *   explicitly specified and using a regex with flag `g`, `scope` is 'all'.
 * @returns {String} New string with one or all matches replaced.
 * @example
 *
 * // Regex search, using named backreferences in replacement string
 * var name = XRegExp('(?<first>\\w+) (?<last>\\w+)');
 * XRegExp.replace('John Smith', name, '${last}, ${first}');
 * // -> 'Smith, John'
 *
 * // Regex search, using named backreferences in replacement function
 * XRegExp.replace('John Smith', name, function (match) {
 *   return match.last + ', ' + match.first;
 * });
 * // -> 'Smith, John'
 *
 * // Global string search/replacement
 * XRegExp.replace('RegExp builds RegExps', 'RegExp', 'XRegExp', 'all');
 * // -> 'XRegExp builds XRegExps'
 */
    self.replace = function (str, search, replacement, scope) {
        var isRegex = self.isRegExp(search),
            search2 = search,
            result;
        if (isRegex) {
            if (scope === undef && search.global) {
                scope = "all"; // Follow flag g when `scope` isn't explicit
            }
            // Note that since a copy is used, `search`'s `lastIndex` isn't updated *during* replacement iterations
            search2 = copy(search, scope === "all" ? "g" : "", scope === "all" ? "" : "g");
        } else if (scope === "all") {
            search2 = new RegExp(self.escape(String(search)), "g");
        }
        result = fixed.replace.call(String(str), search2, replacement); // Fixed `replace` required for named backreferences, etc.
        if (isRegex && search.global) {
            search.lastIndex = 0; // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
        }
        return result;
    };

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @memberOf XRegExp
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * XRegExp.split('a b c', ' ');
 * // -> ['a', 'b', 'c']
 *
 * // With limit
 * XRegExp.split('a b c', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * XRegExp.split('..word1..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', '..']
 */
    self.split = function (str, separator, limit) {
        return fixed.split.call(str, separator, limit);
    };

/**
 * Executes a regex search in a specified string. Returns `true` or `false`. Optional `pos` and
 * `sticky` arguments specify the search start position, and whether the match must start at the
 * specified position only. The `lastIndex` property of the provided regex is not used, but is
 * updated for compatibility. Also fixes browser bugs compared to the native
 * `RegExp.prototype.test` and can be used reliably cross-browser.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Number} [pos=0] Zero-based index at which to start the search.
 * @param {Boolean|String} [sticky=false] Whether the match must start at the specified position
 *   only. The string `'sticky'` is accepted as an alternative to `true`.
 * @returns {Boolean} Whether the regex matched the provided value.
 * @example
 *
 * // Basic use
 * XRegExp.test('abc', /c/); // -> true
 *
 * // With pos and sticky
 * XRegExp.test('abc', /c/, 0, 'sticky'); // -> false
 */
    self.test = function (str, regex, pos, sticky) {
        // Do this the easy way :-)
        return !!self.exec(str, regex, pos, sticky);
    };

/**
 * Uninstalls optional features according to the specified options.
 * @memberOf XRegExp
 * @param {Object|String} options Options object or string.
 * @example
 *
 * // With an options object
 * XRegExp.uninstall({
 *   // Restores native regex methods
 *   natives: true,
 *
 *   // Disables additional syntax and flag extensions
 *   extensibility: true
 * });
 *
 * // With an options string
 * XRegExp.uninstall('natives extensibility');
 *
 * // Using a shortcut to uninstall all optional features
 * XRegExp.uninstall('all');
 */
    self.uninstall = function (options) {
        options = prepareOptions(options);
        if (features.natives && options.natives) {
            setNatives(false);
        }
        if (features.extensibility && options.extensibility) {
            setExtensibility(false);
        }
    };

/**
 * Returns an XRegExp object that is the union of the given patterns. Patterns can be provided as
 * regex objects or strings. Metacharacters are escaped in patterns provided as strings.
 * Backreferences in provided regex objects are automatically renumbered to work correctly. Native
 * flags used by provided regexes are ignored in favor of the `flags` argument.
 * @memberOf XRegExp
 * @param {Array} patterns Regexes and strings to combine.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Union of the provided regexes and strings.
 * @example
 *
 * XRegExp.union(['a+b*c', /(dogs)\1/, /(cats)\1/], 'i');
 * // -> /a\+b\*c|(dogs)\1|(cats)\2/i
 *
 * XRegExp.union([XRegExp('(?<pet>dogs)\\k<pet>'), XRegExp('(?<pet>cats)\\k<pet>')]);
 * // -> XRegExp('(?<pet>dogs)\\k<pet>|(?<pet>cats)\\k<pet>')
 */
    self.union = function (patterns, flags) {
        var parts = /(\()(?!\?)|\\([1-9]\d*)|\\[\s\S]|\[(?:[^\\\]]|\\[\s\S])*]/g,
            numCaptures = 0,
            numPriorCaptures,
            captureNames,
            rewrite = function (match, paren, backref) {
                var name = captureNames[numCaptures - numPriorCaptures];
                if (paren) { // Capturing group
                    ++numCaptures;
                    if (name) { // If the current capture has a name
                        return "(?<" + name + ">";
                    }
                } else if (backref) { // Backreference
                    return "\\" + (+backref + numPriorCaptures);
                }
                return match;
            },
            output = [],
            pattern,
            i;
        if (!(isType(patterns, "array") && patterns.length)) {
            throw new TypeError("patterns must be a nonempty array");
        }
        for (i = 0; i < patterns.length; ++i) {
            pattern = patterns[i];
            if (self.isRegExp(pattern)) {
                numPriorCaptures = numCaptures;
                captureNames = (pattern.xregexp && pattern.xregexp.captureNames) || [];
                // Rewrite backreferences. Passing to XRegExp dies on octals and ensures patterns
                // are independently valid; helps keep this simple. Named captures are put back
                output.push(self(pattern.source).source.replace(parts, rewrite));
            } else {
                output.push(self.escape(pattern));
            }
        }
        return self(output.join("|"), flags);
    };

/**
 * The XRegExp version number.
 * @static
 * @memberOf XRegExp
 * @type String
 */
    self.version = "2.0.0";

/*--------------------------------------
 *  Fixed/extended native methods
 *------------------------------------*/

/**
 * Adds named capture support (with backreferences returned as `result.name`), and fixes browser
 * bugs in the native `RegExp.prototype.exec`. Calling `XRegExp.install('natives')` uses this to
 * override the native method. Use via `XRegExp.exec` without overriding natives.
 * @private
 * @param {String} str String to search.
 * @returns {Array} Match array with named backreference properties, or null.
 */
    fixed.exec = function (str) {
        var match, name, r2, origLastIndex, i;
        if (!this.global) {
            origLastIndex = this.lastIndex;
        }
        match = nativ.exec.apply(this, arguments);
        if (match) {
            // Fix browsers whose `exec` methods don't consistently return `undefined` for
            // nonparticipating capturing groups
            if (!compliantExecNpcg && match.length > 1 && lastIndexOf(match, "") > -1) {
                r2 = new RegExp(this.source, nativ.replace.call(getNativeFlags(this), "g", ""));
                // Using `str.slice(match.index)` rather than `match[0]` in case lookahead allowed
                // matching due to characters outside the match
                nativ.replace.call(String(str).slice(match.index), r2, function () {
                    var i;
                    for (i = 1; i < arguments.length - 2; ++i) {
                        if (arguments[i] === undef) {
                            match[i] = undef;
                        }
                    }
                });
            }
            // Attach named capture properties
            if (this.xregexp && this.xregexp.captureNames) {
                for (i = 1; i < match.length; ++i) {
                    name = this.xregexp.captureNames[i - 1];
                    if (name) {
                        match[name] = match[i];
                    }
                }
            }
            // Fix browsers that increment `lastIndex` after zero-length matches
            if (this.global && !match[0].length && (this.lastIndex > match.index)) {
                this.lastIndex = match.index;
            }
        }
        if (!this.global) {
            this.lastIndex = origLastIndex; // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
        }
        return match;
    };

/**
 * Fixes browser bugs in the native `RegExp.prototype.test`. Calling `XRegExp.install('natives')`
 * uses this to override the native method.
 * @private
 * @param {String} str String to search.
 * @returns {Boolean} Whether the regex matched the provided value.
 */
    fixed.test = function (str) {
        // Do this the easy way :-)
        return !!fixed.exec.call(this, str);
    };

/**
 * Adds named capture support (with backreferences returned as `result.name`), and fixes browser
 * bugs in the native `String.prototype.match`. Calling `XRegExp.install('natives')` uses this to
 * override the native method.
 * @private
 * @param {RegExp} regex Regex to search with.
 * @returns {Array} If `regex` uses flag g, an array of match strings or null. Without flag g, the
 *   result of calling `regex.exec(this)`.
 */
    fixed.match = function (regex) {
        if (!self.isRegExp(regex)) {
            regex = new RegExp(regex); // Use native `RegExp`
        } else if (regex.global) {
            var result = nativ.match.apply(this, arguments);
            regex.lastIndex = 0; // Fixes IE bug
            return result;
        }
        return fixed.exec.call(regex, this);
    };

/**
 * Adds support for `${n}` tokens for named and numbered backreferences in replacement text, and
 * provides named backreferences to replacement functions as `arguments[0].name`. Also fixes
 * browser bugs in replacement text syntax when performing a replacement using a nonregex search
 * value, and the value of a replacement regex's `lastIndex` property during replacement iterations
 * and upon completion. Note that this doesn't support SpiderMonkey's proprietary third (`flags`)
 * argument. Calling `XRegExp.install('natives')` uses this to override the native method. Use via
 * `XRegExp.replace` without overriding natives.
 * @private
 * @param {RegExp|String} search Search pattern to be replaced.
 * @param {String|Function} replacement Replacement string or a function invoked to create it.
 * @returns {String} New string with one or all matches replaced.
 */
    fixed.replace = function (search, replacement) {
        var isRegex = self.isRegExp(search), captureNames, result, str, origLastIndex;
        if (isRegex) {
            if (search.xregexp) {
                captureNames = search.xregexp.captureNames;
            }
            if (!search.global) {
                origLastIndex = search.lastIndex;
            }
        } else {
            search += "";
        }
        if (isType(replacement, "function")) {
            result = nativ.replace.call(String(this), search, function () {
                var args = arguments, i;
                if (captureNames) {
                    // Change the `arguments[0]` string primitive to a `String` object that can store properties
                    args[0] = new String(args[0]);
                    // Store named backreferences on the first argument
                    for (i = 0; i < captureNames.length; ++i) {
                        if (captureNames[i]) {
                            args[0][captureNames[i]] = args[i + 1];
                        }
                    }
                }
                // Update `lastIndex` before calling `replacement`.
                // Fixes IE, Chrome, Firefox, Safari bug (last tested IE 9, Chrome 17, Firefox 11, Safari 5.1)
                if (isRegex && search.global) {
                    search.lastIndex = args[args.length - 2] + args[0].length;
                }
                return replacement.apply(null, args);
            });
        } else {
            str = String(this); // Ensure `args[args.length - 1]` will be a string when given nonstring `this`
            result = nativ.replace.call(str, search, function () {
                var args = arguments; // Keep this function's `arguments` available through closure
                return nativ.replace.call(String(replacement), replacementToken, function ($0, $1, $2) {
                    var n;
                    // Named or numbered backreference with curly brackets
                    if ($1) {
                        /* XRegExp behavior for `${n}`:
                         * 1. Backreference to numbered capture, where `n` is 1+ digits. `0`, `00`, etc. is the entire match.
                         * 2. Backreference to named capture `n`, if it exists and is not a number overridden by numbered capture.
                         * 3. Otherwise, it's an error.
                         */
                        n = +$1; // Type-convert; drop leading zeros
                        if (n <= args.length - 3) {
                            return args[n] || "";
                        }
                        n = captureNames ? lastIndexOf(captureNames, $1) : -1;
                        if (n < 0) {
                            throw new SyntaxError("backreference to undefined group " + $0);
                        }
                        return args[n + 1] || "";
                    }
                    // Else, special variable or numbered backreference (without curly brackets)
                    if ($2 === "$") return "$";
                    if ($2 === "&" || +$2 === 0) return args[0]; // $&, $0 (not followed by 1-9), $00
                    if ($2 === "`") return args[args.length - 1].slice(0, args[args.length - 2]);
                    if ($2 === "'") return args[args.length - 1].slice(args[args.length - 2] + args[0].length);
                    // Else, numbered backreference (without curly brackets)
                    $2 = +$2; // Type-convert; drop leading zero
                    /* XRegExp behavior:
                     * - Backreferences without curly brackets end after 1 or 2 digits. Use `${..}` for more digits.
                     * - `$1` is an error if there are no capturing groups.
                     * - `$10` is an error if there are less than 10 capturing groups. Use `${1}0` instead.
                     * - `$01` is equivalent to `$1` if a capturing group exists, otherwise it's an error.
                     * - `$0` (not followed by 1-9), `$00`, and `$&` are the entire match.
                     * Native behavior, for comparison:
                     * - Backreferences end after 1 or 2 digits. Cannot use backreference to capturing group 100+.
                     * - `$1` is a literal `$1` if there are no capturing groups.
                     * - `$10` is `$1` followed by a literal `0` if there are less than 10 capturing groups.
                     * - `$01` is equivalent to `$1` if a capturing group exists, otherwise it's a literal `$01`.
                     * - `$0` is a literal `$0`. `$&` is the entire match.
                     */
                    if (!isNaN($2)) {
                        if ($2 > args.length - 3) {
                            throw new SyntaxError("backreference to undefined group " + $0);
                        }
                        return args[$2] || "";
                    }
                    throw new SyntaxError("invalid token " + $0);
                });
            });
        }
        if (isRegex) {
            if (search.global) {
                search.lastIndex = 0; // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
            } else {
                search.lastIndex = origLastIndex; // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
            }
        }
        return result;
    };

/**
 * Fixes browser bugs in the native `String.prototype.split`. Calling `XRegExp.install('natives')`
 * uses this to override the native method. Use via `XRegExp.split` without overriding natives.
 * @private
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 */
    fixed.split = function (separator, limit) {
        if (!self.isRegExp(separator)) {
            return nativ.split.apply(this, arguments); // use faster native method
        }
        var str = String(this),
            origLastIndex = separator.lastIndex,
            output = [],
            lastLastIndex = 0,
            lastLength;
        /* Values for `limit`, per the spec:
         * If undefined: pow(2,32) - 1
         * If 0, Infinity, or NaN: 0
         * If positive number: limit = floor(limit); if (limit >= pow(2,32)) limit -= pow(2,32);
         * If negative number: pow(2,32) - floor(abs(limit))
         * If other: Type-convert, then use the above rules
         */
        limit = (limit === undef ? -1 : limit) >>> 0;
        self.forEach(str, separator, function (match) {
            if ((match.index + match[0].length) > lastLastIndex) { // != `if (match[0].length)`
                output.push(str.slice(lastLastIndex, match.index));
                if (match.length > 1 && match.index < str.length) {
                    Array.prototype.push.apply(output, match.slice(1));
                }
                lastLength = match[0].length;
                lastLastIndex = match.index + lastLength;
            }
        });
        if (lastLastIndex === str.length) {
            if (!nativ.test.call(separator, "") || lastLength) {
                output.push("");
            }
        } else {
            output.push(str.slice(lastLastIndex));
        }
        separator.lastIndex = origLastIndex;
        return output.length > limit ? output.slice(0, limit) : output;
    };

/*--------------------------------------
 *  Built-in tokens
 *------------------------------------*/

// Shortcut
    add = addToken.on;

/* Letter identity escapes that natively match literal characters: \p, \P, etc.
 * Should be SyntaxErrors but are allowed in web reality. XRegExp makes them errors for cross-
 * browser consistency and to reserve their syntax, but lets them be superseded by XRegExp addons.
 */
    add(/\\([ABCE-RTUVXYZaeg-mopqyz]|c(?![A-Za-z])|u(?![\dA-Fa-f]{4})|x(?![\dA-Fa-f]{2}))/,
        function (match, scope) {
            // \B is allowed in default scope only
            if (match[1] === "B" && scope === defaultScope) {
                return match[0];
            }
            throw new SyntaxError("invalid escape " + match[0]);
        },
        {scope: "all"});

/* Empty character class: [] or [^]
 * Fixes a critical cross-browser syntax inconsistency. Unless this is standardized (per the spec),
 * regex syntax can't be accurately parsed because character class endings can't be determined.
 */
    add(/\[(\^?)]/,
        function (match) {
            // For cross-browser compatibility with ES3, convert [] to \b\B and [^] to [\s\S].
            // (?!) should work like \b\B, but is unreliable in Firefox
            return match[1] ? "[\\s\\S]" : "\\b\\B";
        });

/* Comment pattern: (?# )
 * Inline comments are an alternative to the line comments allowed in free-spacing mode (flag x).
 */
    add(/(?:\(\?#[^)]*\))+/,
        function (match) {
            // Keep tokens separated unless the following token is a quantifier
            return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
        });

/* Named backreference: \k<name>
 * Backreference names can use the characters A-Z, a-z, 0-9, _, and $ only.
 */
    add(/\\k<([\w$]+)>/,
        function (match) {
            var index = isNaN(match[1]) ? (lastIndexOf(this.captureNames, match[1]) + 1) : +match[1],
                endIndex = match.index + match[0].length;
            if (!index || index > this.captureNames.length) {
                throw new SyntaxError("backreference to undefined group " + match[0]);
            }
            // Keep backreferences separate from subsequent literal numbers
            return "\\" + index + (
                endIndex === match.input.length || isNaN(match.input.charAt(endIndex)) ? "" : "(?:)"
            );
        });

/* Whitespace and line comments, in free-spacing mode (aka extended mode, flag x) only.
 */
    add(/(?:\s+|#.*)+/,
        function (match) {
            // Keep tokens separated unless the following token is a quantifier
            return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
        },
        {
            trigger: function () {
                return this.hasFlag("x");
            },
            customFlags: "x"
        });

/* Dot, in dotall mode (aka singleline mode, flag s) only.
 */
    add(/\./,
        function () {
            return "[\\s\\S]";
        },
        {
            trigger: function () {
                return this.hasFlag("s");
            },
            customFlags: "s"
        });

/* Named capturing group; match the opening delimiter only: (?<name>
 * Capture names can use the characters A-Z, a-z, 0-9, _, and $ only. Names can't be integers.
 * Supports Python-style (?P<name> as an alternate syntax to avoid issues in recent Opera (which
 * natively supports the Python-style syntax). Otherwise, XRegExp might treat numbered
 * backreferences to Python-style named capture as octals.
 */
    add(/\(\?P?<([\w$]+)>/,
        function (match) {
            if (!isNaN(match[1])) {
                // Avoid incorrect lookups, since named backreferences are added to match arrays
                throw new SyntaxError("can't use integer as capture name " + match[0]);
            }
            this.captureNames.push(match[1]);
            this.hasNamedCapture = true;
            return "(";
        });

/* Numbered backreference or octal, plus any following digits: \0, \11, etc.
 * Octals except \0 not followed by 0-9 and backreferences to unopened capture groups throw an
 * error. Other matches are returned unaltered. IE <= 8 doesn't support backreferences greater than
 * \99 in regex syntax.
 */
    add(/\\(\d+)/,
        function (match, scope) {
            if (!(scope === defaultScope && /^[1-9]/.test(match[1]) && +match[1] <= this.captureNames.length) &&
                    match[1] !== "0") {
                throw new SyntaxError("can't use octal escape or backreference to undefined group " + match[0]);
            }
            return match[0];
        },
        {scope: "all"});

/* Capturing group; match the opening parenthesis only.
 * Required for support of named capturing groups. Also adds explicit capture mode (flag n).
 */
    add(/\((?!\?)/,
        function () {
            if (this.hasFlag("n")) {
                return "(?:";
            }
            this.captureNames.push(null);
            return "(";
        },
        {customFlags: "n"});

/*--------------------------------------
 *  Expose XRegExp
 *------------------------------------*/

// For CommonJS enviroments
    if (typeof exports !== "undefined") {
        exports.XRegExp = self;
    }

    return self;

}());


/***** unicode-base.js *****/

/*!
 * XRegExp Unicode Base v1.0.0
 * (c) 2008-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Uses Unicode 6.1 <http://unicode.org/>
 */

/**
 * Adds support for the `\p{L}` or `\p{Letter}` Unicode category. Addon packages for other Unicode
 * categories, scripts, blocks, and properties are available separately. All Unicode tokens can be
 * inverted using `\P{..}` or `\p{^..}`. Token names are case insensitive, and any spaces, hyphens,
 * and underscores are ignored.
 * @requires XRegExp
 */
(function (XRegExp) {
    "use strict";

    var unicode = {};

/*--------------------------------------
 *  Private helper functions
 *------------------------------------*/

// Generates a standardized token name (lowercase, with hyphens, spaces, and underscores removed)
    function slug(name) {
        return name.replace(/[- _]+/g, "").toLowerCase();
    }

// Expands a list of Unicode code points and ranges to be usable in a regex character class
    function expand(str) {
        return str.replace(/\w{4}/g, "\\u$&");
    }

// Adds leading zeros if shorter than four characters
    function pad4(str) {
        while (str.length < 4) {
            str = "0" + str;
        }
        return str;
    }

// Converts a hexadecimal number to decimal
    function dec(hex) {
        return parseInt(hex, 16);
    }

// Converts a decimal number to hexadecimal
    function hex(dec) {
        return parseInt(dec, 10).toString(16);
    }

// Inverts a list of Unicode code points and ranges
    function invert(range) {
        var output = [],
            lastEnd = -1,
            start;
        XRegExp.forEach(range, /\\u(\w{4})(?:-\\u(\w{4}))?/, function (m) {
            start = dec(m[1]);
            if (start > (lastEnd + 1)) {
                output.push("\\u" + pad4(hex(lastEnd + 1)));
                if (start > (lastEnd + 2)) {
                    output.push("-\\u" + pad4(hex(start - 1)));
                }
            }
            lastEnd = dec(m[2] || m[1]);
        });
        if (lastEnd < 0xFFFF) {
            output.push("\\u" + pad4(hex(lastEnd + 1)));
            if (lastEnd < 0xFFFE) {
                output.push("-\\uFFFF");
            }
        }
        return output.join("");
    }

// Generates an inverted token on first use
    function cacheInversion(item) {
        return unicode["^" + item] || (unicode["^" + item] = invert(unicode[item]));
    }

/*--------------------------------------
 *  Core functionality
 *------------------------------------*/

    XRegExp.install("extensibility");

/**
 * Adds to the list of Unicode properties that XRegExp regexes can match via \p{..} or \P{..}.
 * @memberOf XRegExp
 * @param {Object} pack Named sets of Unicode code points and ranges.
 * @param {Object} [aliases] Aliases for the primary token names.
 * @example
 *
 * XRegExp.addUnicodePackage({
 *   XDigit: '0030-00390041-00460061-0066' // 0-9A-Fa-f
 * }, {
 *   XDigit: 'Hexadecimal'
 * });
 */
    XRegExp.addUnicodePackage = function (pack, aliases) {
        var p;
        if (!XRegExp.isInstalled("extensibility")) {
            throw new Error("extensibility must be installed before adding Unicode packages");
        }
        if (pack) {
            for (p in pack) {
                if (pack.hasOwnProperty(p)) {
                    unicode[slug(p)] = expand(pack[p]);
                }
            }
        }
        if (aliases) {
            for (p in aliases) {
                if (aliases.hasOwnProperty(p)) {
                    unicode[slug(aliases[p])] = unicode[slug(p)];
                }
            }
        }
    };

/* Adds data for the Unicode `Letter` category. Addon packages include other categories, scripts,
 * blocks, and properties.
 */
    XRegExp.addUnicodePackage({
        L: "0041-005A0061-007A00AA00B500BA00C0-00D600D8-00F600F8-02C102C6-02D102E0-02E402EC02EE0370-037403760377037A-037D03860388-038A038C038E-03A103A3-03F503F7-0481048A-05270531-055605590561-058705D0-05EA05F0-05F20620-064A066E066F0671-06D306D506E506E606EE06EF06FA-06FC06FF07100712-072F074D-07A507B107CA-07EA07F407F507FA0800-0815081A082408280840-085808A008A2-08AC0904-0939093D09500958-09610971-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE00AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E460E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC40EC60EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066106E-10701075-1081108E10A0-10C510C710CD10D0-10FA10FC-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-17311740-17511760-176C176E-17701780-17B317D717DC1820-18771880-18A818AA18B0-18F51900-191C1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541AA71B05-1B331B45-1B4B1B83-1BA01BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C7D1CE9-1CEC1CEE-1CF11CF51CF61D00-1DBF1E00-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FBC1FBE1FC2-1FC41FC6-1FCC1FD0-1FD31FD6-1FDB1FE0-1FEC1FF2-1FF41FF6-1FFC2071207F2090-209C21022107210A-211321152119-211D212421262128212A-212D212F-2139213C-213F2145-2149214E218321842C00-2C2E2C30-2C5E2C60-2CE42CEB-2CEE2CF22CF32D00-2D252D272D2D2D30-2D672D6F2D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE2E2F300530063031-3035303B303C3041-3096309D-309F30A1-30FA30FC-30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A48CA4D0-A4FDA500-A60CA610-A61FA62AA62BA640-A66EA67F-A697A6A0-A6E5A717-A71FA722-A788A78B-A78EA790-A793A7A0-A7AAA7F8-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2A9CFAA00-AA28AA40-AA42AA44-AA4BAA60-AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADB-AADDAAE0-AAEAAAF2-AAF4AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB00-FB06FB13-FB17FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF21-FF3AFF41-FF5AFF66-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC"
    }, {
        L: "Letter"
    });

/* Adds Unicode property syntax to XRegExp: \p{..}, \P{..}, \p{^..}
 */
    XRegExp.addToken(
        /\\([pP]){(\^?)([^}]*)}/,
        function (match, scope) {
            var inv = (match[1] === "P" || match[2]) ? "^" : "",
                item = slug(match[3]);
            // The double negative \P{^..} is invalid
            if (match[1] === "P" && match[2]) {
                throw new SyntaxError("invalid double negation \\P{^");
            }
            if (!unicode.hasOwnProperty(item)) {
                throw new SyntaxError("invalid or unknown Unicode property " + match[0]);
            }
            return scope === "class" ?
                    (inv ? cacheInversion(item) : unicode[item]) :
                    "[" + inv + unicode[item] + "]";
        },
        {scope: "all"}
    );

}(XRegExp));


/***** unicode-categories.js *****/

/*!
 * XRegExp Unicode Categories v1.2.0
 * (c) 2010-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Uses Unicode 6.1 <http://unicode.org/>
 */

/**
 * Adds support for all Unicode categories (aka properties) E.g., `\p{Lu}` or
 * `\p{Uppercase Letter}`. Token names are case insensitive, and any spaces, hyphens, and
 * underscores are ignored.
 * @requires XRegExp, XRegExp Unicode Base
 */
(function (XRegExp) {
    "use strict";

    if (!XRegExp.addUnicodePackage) {
        throw new ReferenceError("Unicode Base must be loaded before Unicode Categories");
    }

    XRegExp.install("extensibility");

    XRegExp.addUnicodePackage({
        //L: "", // Included in the Unicode Base addon
        Ll: "0061-007A00B500DF-00F600F8-00FF01010103010501070109010B010D010F01110113011501170119011B011D011F01210123012501270129012B012D012F01310133013501370138013A013C013E014001420144014601480149014B014D014F01510153015501570159015B015D015F01610163016501670169016B016D016F0171017301750177017A017C017E-0180018301850188018C018D019201950199-019B019E01A101A301A501A801AA01AB01AD01B001B401B601B901BA01BD-01BF01C601C901CC01CE01D001D201D401D601D801DA01DC01DD01DF01E101E301E501E701E901EB01ED01EF01F001F301F501F901FB01FD01FF02010203020502070209020B020D020F02110213021502170219021B021D021F02210223022502270229022B022D022F02310233-0239023C023F0240024202470249024B024D024F-02930295-02AF037103730377037B-037D039003AC-03CE03D003D103D5-03D703D903DB03DD03DF03E103E303E503E703E903EB03ED03EF-03F303F503F803FB03FC0430-045F04610463046504670469046B046D046F04710473047504770479047B047D047F0481048B048D048F04910493049504970499049B049D049F04A104A304A504A704A904AB04AD04AF04B104B304B504B704B904BB04BD04BF04C204C404C604C804CA04CC04CE04CF04D104D304D504D704D904DB04DD04DF04E104E304E504E704E904EB04ED04EF04F104F304F504F704F904FB04FD04FF05010503050505070509050B050D050F05110513051505170519051B051D051F05210523052505270561-05871D00-1D2B1D6B-1D771D79-1D9A1E011E031E051E071E091E0B1E0D1E0F1E111E131E151E171E191E1B1E1D1E1F1E211E231E251E271E291E2B1E2D1E2F1E311E331E351E371E391E3B1E3D1E3F1E411E431E451E471E491E4B1E4D1E4F1E511E531E551E571E591E5B1E5D1E5F1E611E631E651E671E691E6B1E6D1E6F1E711E731E751E771E791E7B1E7D1E7F1E811E831E851E871E891E8B1E8D1E8F1E911E931E95-1E9D1E9F1EA11EA31EA51EA71EA91EAB1EAD1EAF1EB11EB31EB51EB71EB91EBB1EBD1EBF1EC11EC31EC51EC71EC91ECB1ECD1ECF1ED11ED31ED51ED71ED91EDB1EDD1EDF1EE11EE31EE51EE71EE91EEB1EED1EEF1EF11EF31EF51EF71EF91EFB1EFD1EFF-1F071F10-1F151F20-1F271F30-1F371F40-1F451F50-1F571F60-1F671F70-1F7D1F80-1F871F90-1F971FA0-1FA71FB0-1FB41FB61FB71FBE1FC2-1FC41FC61FC71FD0-1FD31FD61FD71FE0-1FE71FF2-1FF41FF61FF7210A210E210F2113212F21342139213C213D2146-2149214E21842C30-2C5E2C612C652C662C682C6A2C6C2C712C732C742C76-2C7B2C812C832C852C872C892C8B2C8D2C8F2C912C932C952C972C992C9B2C9D2C9F2CA12CA32CA52CA72CA92CAB2CAD2CAF2CB12CB32CB52CB72CB92CBB2CBD2CBF2CC12CC32CC52CC72CC92CCB2CCD2CCF2CD12CD32CD52CD72CD92CDB2CDD2CDF2CE12CE32CE42CEC2CEE2CF32D00-2D252D272D2DA641A643A645A647A649A64BA64DA64FA651A653A655A657A659A65BA65DA65FA661A663A665A667A669A66BA66DA681A683A685A687A689A68BA68DA68FA691A693A695A697A723A725A727A729A72BA72DA72F-A731A733A735A737A739A73BA73DA73FA741A743A745A747A749A74BA74DA74FA751A753A755A757A759A75BA75DA75FA761A763A765A767A769A76BA76DA76FA771-A778A77AA77CA77FA781A783A785A787A78CA78EA791A793A7A1A7A3A7A5A7A7A7A9A7FAFB00-FB06FB13-FB17FF41-FF5A",
        Lu: "0041-005A00C0-00D600D8-00DE01000102010401060108010A010C010E01100112011401160118011A011C011E01200122012401260128012A012C012E01300132013401360139013B013D013F0141014301450147014A014C014E01500152015401560158015A015C015E01600162016401660168016A016C016E017001720174017601780179017B017D018101820184018601870189-018B018E-0191019301940196-0198019C019D019F01A001A201A401A601A701A901AC01AE01AF01B1-01B301B501B701B801BC01C401C701CA01CD01CF01D101D301D501D701D901DB01DE01E001E201E401E601E801EA01EC01EE01F101F401F6-01F801FA01FC01FE02000202020402060208020A020C020E02100212021402160218021A021C021E02200222022402260228022A022C022E02300232023A023B023D023E02410243-02460248024A024C024E03700372037603860388-038A038C038E038F0391-03A103A3-03AB03CF03D2-03D403D803DA03DC03DE03E003E203E403E603E803EA03EC03EE03F403F703F903FA03FD-042F04600462046404660468046A046C046E04700472047404760478047A047C047E0480048A048C048E04900492049404960498049A049C049E04A004A204A404A604A804AA04AC04AE04B004B204B404B604B804BA04BC04BE04C004C104C304C504C704C904CB04CD04D004D204D404D604D804DA04DC04DE04E004E204E404E604E804EA04EC04EE04F004F204F404F604F804FA04FC04FE05000502050405060508050A050C050E05100512051405160518051A051C051E05200522052405260531-055610A0-10C510C710CD1E001E021E041E061E081E0A1E0C1E0E1E101E121E141E161E181E1A1E1C1E1E1E201E221E241E261E281E2A1E2C1E2E1E301E321E341E361E381E3A1E3C1E3E1E401E421E441E461E481E4A1E4C1E4E1E501E521E541E561E581E5A1E5C1E5E1E601E621E641E661E681E6A1E6C1E6E1E701E721E741E761E781E7A1E7C1E7E1E801E821E841E861E881E8A1E8C1E8E1E901E921E941E9E1EA01EA21EA41EA61EA81EAA1EAC1EAE1EB01EB21EB41EB61EB81EBA1EBC1EBE1EC01EC21EC41EC61EC81ECA1ECC1ECE1ED01ED21ED41ED61ED81EDA1EDC1EDE1EE01EE21EE41EE61EE81EEA1EEC1EEE1EF01EF21EF41EF61EF81EFA1EFC1EFE1F08-1F0F1F18-1F1D1F28-1F2F1F38-1F3F1F48-1F4D1F591F5B1F5D1F5F1F68-1F6F1FB8-1FBB1FC8-1FCB1FD8-1FDB1FE8-1FEC1FF8-1FFB21022107210B-210D2110-211221152119-211D212421262128212A-212D2130-2133213E213F214521832C00-2C2E2C602C62-2C642C672C692C6B2C6D-2C702C722C752C7E-2C802C822C842C862C882C8A2C8C2C8E2C902C922C942C962C982C9A2C9C2C9E2CA02CA22CA42CA62CA82CAA2CAC2CAE2CB02CB22CB42CB62CB82CBA2CBC2CBE2CC02CC22CC42CC62CC82CCA2CCC2CCE2CD02CD22CD42CD62CD82CDA2CDC2CDE2CE02CE22CEB2CED2CF2A640A642A644A646A648A64AA64CA64EA650A652A654A656A658A65AA65CA65EA660A662A664A666A668A66AA66CA680A682A684A686A688A68AA68CA68EA690A692A694A696A722A724A726A728A72AA72CA72EA732A734A736A738A73AA73CA73EA740A742A744A746A748A74AA74CA74EA750A752A754A756A758A75AA75CA75EA760A762A764A766A768A76AA76CA76EA779A77BA77DA77EA780A782A784A786A78BA78DA790A792A7A0A7A2A7A4A7A6A7A8A7AAFF21-FF3A",
        Lt: "01C501C801CB01F21F88-1F8F1F98-1F9F1FA8-1FAF1FBC1FCC1FFC",
        Lm: "02B0-02C102C6-02D102E0-02E402EC02EE0374037A0559064006E506E607F407F507FA081A0824082809710E460EC610FC17D718431AA71C78-1C7D1D2C-1D6A1D781D9B-1DBF2071207F2090-209C2C7C2C7D2D6F2E2F30053031-3035303B309D309E30FC-30FEA015A4F8-A4FDA60CA67FA717-A71FA770A788A7F8A7F9A9CFAA70AADDAAF3AAF4FF70FF9EFF9F",
        Lo: "00AA00BA01BB01C0-01C3029405D0-05EA05F0-05F20620-063F0641-064A066E066F0671-06D306D506EE06EF06FA-06FC06FF07100712-072F074D-07A507B107CA-07EA0800-08150840-085808A008A2-08AC0904-0939093D09500958-09610972-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE00AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E450E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC40EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066106E-10701075-1081108E10D0-10FA10FD-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-17311740-17511760-176C176E-17701780-17B317DC1820-18421844-18771880-18A818AA18B0-18F51900-191C1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541B05-1B331B45-1B4B1B83-1BA01BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C771CE9-1CEC1CEE-1CF11CF51CF62135-21382D30-2D672D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE3006303C3041-3096309F30A1-30FA30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A014A016-A48CA4D0-A4F7A500-A60BA610-A61FA62AA62BA66EA6A0-A6E5A7FB-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2AA00-AA28AA40-AA42AA44-AA4BAA60-AA6FAA71-AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADBAADCAAE0-AAEAAAF2AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF66-FF6FFF71-FF9DFFA0-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
        M: "0300-036F0483-04890591-05BD05BF05C105C205C405C505C70610-061A064B-065F067006D6-06DC06DF-06E406E706E806EA-06ED07110730-074A07A6-07B007EB-07F30816-0819081B-08230825-08270829-082D0859-085B08E4-08FE0900-0903093A-093C093E-094F0951-0957096209630981-098309BC09BE-09C409C709C809CB-09CD09D709E209E30A01-0A030A3C0A3E-0A420A470A480A4B-0A4D0A510A700A710A750A81-0A830ABC0ABE-0AC50AC7-0AC90ACB-0ACD0AE20AE30B01-0B030B3C0B3E-0B440B470B480B4B-0B4D0B560B570B620B630B820BBE-0BC20BC6-0BC80BCA-0BCD0BD70C01-0C030C3E-0C440C46-0C480C4A-0C4D0C550C560C620C630C820C830CBC0CBE-0CC40CC6-0CC80CCA-0CCD0CD50CD60CE20CE30D020D030D3E-0D440D46-0D480D4A-0D4D0D570D620D630D820D830DCA0DCF-0DD40DD60DD8-0DDF0DF20DF30E310E34-0E3A0E47-0E4E0EB10EB4-0EB90EBB0EBC0EC8-0ECD0F180F190F350F370F390F3E0F3F0F71-0F840F860F870F8D-0F970F99-0FBC0FC6102B-103E1056-1059105E-10601062-10641067-106D1071-10741082-108D108F109A-109D135D-135F1712-17141732-1734175217531772177317B4-17D317DD180B-180D18A91920-192B1930-193B19B0-19C019C819C91A17-1A1B1A55-1A5E1A60-1A7C1A7F1B00-1B041B34-1B441B6B-1B731B80-1B821BA1-1BAD1BE6-1BF31C24-1C371CD0-1CD21CD4-1CE81CED1CF2-1CF41DC0-1DE61DFC-1DFF20D0-20F02CEF-2CF12D7F2DE0-2DFF302A-302F3099309AA66F-A672A674-A67DA69FA6F0A6F1A802A806A80BA823-A827A880A881A8B4-A8C4A8E0-A8F1A926-A92DA947-A953A980-A983A9B3-A9C0AA29-AA36AA43AA4CAA4DAA7BAAB0AAB2-AAB4AAB7AAB8AABEAABFAAC1AAEB-AAEFAAF5AAF6ABE3-ABEAABECABEDFB1EFE00-FE0FFE20-FE26",
        Mn: "0300-036F0483-04870591-05BD05BF05C105C205C405C505C70610-061A064B-065F067006D6-06DC06DF-06E406E706E806EA-06ED07110730-074A07A6-07B007EB-07F30816-0819081B-08230825-08270829-082D0859-085B08E4-08FE0900-0902093A093C0941-0948094D0951-095709620963098109BC09C1-09C409CD09E209E30A010A020A3C0A410A420A470A480A4B-0A4D0A510A700A710A750A810A820ABC0AC1-0AC50AC70AC80ACD0AE20AE30B010B3C0B3F0B41-0B440B4D0B560B620B630B820BC00BCD0C3E-0C400C46-0C480C4A-0C4D0C550C560C620C630CBC0CBF0CC60CCC0CCD0CE20CE30D41-0D440D4D0D620D630DCA0DD2-0DD40DD60E310E34-0E3A0E47-0E4E0EB10EB4-0EB90EBB0EBC0EC8-0ECD0F180F190F350F370F390F71-0F7E0F80-0F840F860F870F8D-0F970F99-0FBC0FC6102D-10301032-10371039103A103D103E10581059105E-10601071-1074108210851086108D109D135D-135F1712-17141732-1734175217531772177317B417B517B7-17BD17C617C9-17D317DD180B-180D18A91920-19221927192819321939-193B1A171A181A561A58-1A5E1A601A621A65-1A6C1A73-1A7C1A7F1B00-1B031B341B36-1B3A1B3C1B421B6B-1B731B801B811BA2-1BA51BA81BA91BAB1BE61BE81BE91BED1BEF-1BF11C2C-1C331C361C371CD0-1CD21CD4-1CE01CE2-1CE81CED1CF41DC0-1DE61DFC-1DFF20D0-20DC20E120E5-20F02CEF-2CF12D7F2DE0-2DFF302A-302D3099309AA66FA674-A67DA69FA6F0A6F1A802A806A80BA825A826A8C4A8E0-A8F1A926-A92DA947-A951A980-A982A9B3A9B6-A9B9A9BCAA29-AA2EAA31AA32AA35AA36AA43AA4CAAB0AAB2-AAB4AAB7AAB8AABEAABFAAC1AAECAAEDAAF6ABE5ABE8ABEDFB1EFE00-FE0FFE20-FE26",
        Mc: "0903093B093E-09400949-094C094E094F0982098309BE-09C009C709C809CB09CC09D70A030A3E-0A400A830ABE-0AC00AC90ACB0ACC0B020B030B3E0B400B470B480B4B0B4C0B570BBE0BBF0BC10BC20BC6-0BC80BCA-0BCC0BD70C01-0C030C41-0C440C820C830CBE0CC0-0CC40CC70CC80CCA0CCB0CD50CD60D020D030D3E-0D400D46-0D480D4A-0D4C0D570D820D830DCF-0DD10DD8-0DDF0DF20DF30F3E0F3F0F7F102B102C10311038103B103C105610571062-10641067-106D108310841087-108C108F109A-109C17B617BE-17C517C717C81923-19261929-192B193019311933-193819B0-19C019C819C91A19-1A1B1A551A571A611A631A641A6D-1A721B041B351B3B1B3D-1B411B431B441B821BA11BA61BA71BAA1BAC1BAD1BE71BEA-1BEC1BEE1BF21BF31C24-1C2B1C341C351CE11CF21CF3302E302FA823A824A827A880A881A8B4-A8C3A952A953A983A9B4A9B5A9BAA9BBA9BD-A9C0AA2FAA30AA33AA34AA4DAA7BAAEBAAEEAAEFAAF5ABE3ABE4ABE6ABE7ABE9ABEAABEC",
        Me: "0488048920DD-20E020E2-20E4A670-A672",
        N: "0030-003900B200B300B900BC-00BE0660-066906F0-06F907C0-07C90966-096F09E6-09EF09F4-09F90A66-0A6F0AE6-0AEF0B66-0B6F0B72-0B770BE6-0BF20C66-0C6F0C78-0C7E0CE6-0CEF0D66-0D750E50-0E590ED0-0ED90F20-0F331040-10491090-10991369-137C16EE-16F017E0-17E917F0-17F91810-18191946-194F19D0-19DA1A80-1A891A90-1A991B50-1B591BB0-1BB91C40-1C491C50-1C5920702074-20792080-20892150-21822185-21892460-249B24EA-24FF2776-27932CFD30073021-30293038-303A3192-31953220-32293248-324F3251-325F3280-328932B1-32BFA620-A629A6E6-A6EFA830-A835A8D0-A8D9A900-A909A9D0-A9D9AA50-AA59ABF0-ABF9FF10-FF19",
        Nd: "0030-00390660-066906F0-06F907C0-07C90966-096F09E6-09EF0A66-0A6F0AE6-0AEF0B66-0B6F0BE6-0BEF0C66-0C6F0CE6-0CEF0D66-0D6F0E50-0E590ED0-0ED90F20-0F291040-10491090-109917E0-17E91810-18191946-194F19D0-19D91A80-1A891A90-1A991B50-1B591BB0-1BB91C40-1C491C50-1C59A620-A629A8D0-A8D9A900-A909A9D0-A9D9AA50-AA59ABF0-ABF9FF10-FF19",
        Nl: "16EE-16F02160-21822185-218830073021-30293038-303AA6E6-A6EF",
        No: "00B200B300B900BC-00BE09F4-09F90B72-0B770BF0-0BF20C78-0C7E0D70-0D750F2A-0F331369-137C17F0-17F919DA20702074-20792080-20892150-215F21892460-249B24EA-24FF2776-27932CFD3192-31953220-32293248-324F3251-325F3280-328932B1-32BFA830-A835",
        P: "0021-00230025-002A002C-002F003A003B003F0040005B-005D005F007B007D00A100A700AB00B600B700BB00BF037E0387055A-055F0589058A05BE05C005C305C605F305F40609060A060C060D061B061E061F066A-066D06D40700-070D07F7-07F90830-083E085E0964096509700AF00DF40E4F0E5A0E5B0F04-0F120F140F3A-0F3D0F850FD0-0FD40FD90FDA104A-104F10FB1360-13681400166D166E169B169C16EB-16ED1735173617D4-17D617D8-17DA1800-180A194419451A1E1A1F1AA0-1AA61AA8-1AAD1B5A-1B601BFC-1BFF1C3B-1C3F1C7E1C7F1CC0-1CC71CD32010-20272030-20432045-20512053-205E207D207E208D208E2329232A2768-277527C527C627E6-27EF2983-299829D8-29DB29FC29FD2CF9-2CFC2CFE2CFF2D702E00-2E2E2E30-2E3B3001-30033008-30113014-301F3030303D30A030FBA4FEA4FFA60D-A60FA673A67EA6F2-A6F7A874-A877A8CEA8CFA8F8-A8FAA92EA92FA95FA9C1-A9CDA9DEA9DFAA5C-AA5FAADEAADFAAF0AAF1ABEBFD3EFD3FFE10-FE19FE30-FE52FE54-FE61FE63FE68FE6AFE6BFF01-FF03FF05-FF0AFF0C-FF0FFF1AFF1BFF1FFF20FF3B-FF3DFF3FFF5BFF5DFF5F-FF65",
        Pd: "002D058A05BE140018062010-20152E172E1A2E3A2E3B301C303030A0FE31FE32FE58FE63FF0D",
        Ps: "0028005B007B0F3A0F3C169B201A201E2045207D208D23292768276A276C276E27702772277427C527E627E827EA27EC27EE2983298529872989298B298D298F299129932995299729D829DA29FC2E222E242E262E283008300A300C300E3010301430163018301A301DFD3EFE17FE35FE37FE39FE3BFE3DFE3FFE41FE43FE47FE59FE5BFE5DFF08FF3BFF5BFF5FFF62",
        Pe: "0029005D007D0F3B0F3D169C2046207E208E232A2769276B276D276F27712773277527C627E727E927EB27ED27EF298429862988298A298C298E2990299229942996299829D929DB29FD2E232E252E272E293009300B300D300F3011301530173019301B301E301FFD3FFE18FE36FE38FE3AFE3CFE3EFE40FE42FE44FE48FE5AFE5CFE5EFF09FF3DFF5DFF60FF63",
        Pi: "00AB2018201B201C201F20392E022E042E092E0C2E1C2E20",
        Pf: "00BB2019201D203A2E032E052E0A2E0D2E1D2E21",
        Pc: "005F203F20402054FE33FE34FE4D-FE4FFF3F",
        Po: "0021-00230025-0027002A002C002E002F003A003B003F0040005C00A100A700B600B700BF037E0387055A-055F058905C005C305C605F305F40609060A060C060D061B061E061F066A-066D06D40700-070D07F7-07F90830-083E085E0964096509700AF00DF40E4F0E5A0E5B0F04-0F120F140F850FD0-0FD40FD90FDA104A-104F10FB1360-1368166D166E16EB-16ED1735173617D4-17D617D8-17DA1800-18051807-180A194419451A1E1A1F1AA0-1AA61AA8-1AAD1B5A-1B601BFC-1BFF1C3B-1C3F1C7E1C7F1CC0-1CC71CD3201620172020-20272030-2038203B-203E2041-20432047-205120532055-205E2CF9-2CFC2CFE2CFF2D702E002E012E06-2E082E0B2E0E-2E162E182E192E1B2E1E2E1F2E2A-2E2E2E30-2E393001-3003303D30FBA4FEA4FFA60D-A60FA673A67EA6F2-A6F7A874-A877A8CEA8CFA8F8-A8FAA92EA92FA95FA9C1-A9CDA9DEA9DFAA5C-AA5FAADEAADFAAF0AAF1ABEBFE10-FE16FE19FE30FE45FE46FE49-FE4CFE50-FE52FE54-FE57FE5F-FE61FE68FE6AFE6BFF01-FF03FF05-FF07FF0AFF0CFF0EFF0FFF1AFF1BFF1FFF20FF3CFF61FF64FF65",
        S: "0024002B003C-003E005E0060007C007E00A2-00A600A800A900AC00AE-00B100B400B800D700F702C2-02C502D2-02DF02E5-02EB02ED02EF-02FF03750384038503F60482058F0606-0608060B060E060F06DE06E906FD06FE07F609F209F309FA09FB0AF10B700BF3-0BFA0C7F0D790E3F0F01-0F030F130F15-0F170F1A-0F1F0F340F360F380FBE-0FC50FC7-0FCC0FCE0FCF0FD5-0FD8109E109F1390-139917DB194019DE-19FF1B61-1B6A1B74-1B7C1FBD1FBF-1FC11FCD-1FCF1FDD-1FDF1FED-1FEF1FFD1FFE20442052207A-207C208A-208C20A0-20B9210021012103-21062108210921142116-2118211E-2123212521272129212E213A213B2140-2144214A-214D214F2190-2328232B-23F32400-24262440-244A249C-24E92500-26FF2701-27672794-27C427C7-27E527F0-29822999-29D729DC-29FB29FE-2B4C2B50-2B592CE5-2CEA2E80-2E992E9B-2EF32F00-2FD52FF0-2FFB300430123013302030363037303E303F309B309C319031913196-319F31C0-31E33200-321E322A-324732503260-327F328A-32B032C0-32FE3300-33FF4DC0-4DFFA490-A4C6A700-A716A720A721A789A78AA828-A82BA836-A839AA77-AA79FB29FBB2-FBC1FDFCFDFDFE62FE64-FE66FE69FF04FF0BFF1C-FF1EFF3EFF40FF5CFF5EFFE0-FFE6FFE8-FFEEFFFCFFFD",
        Sm: "002B003C-003E007C007E00AC00B100D700F703F60606-060820442052207A-207C208A-208C21182140-2144214B2190-2194219A219B21A021A321A621AE21CE21CF21D221D421F4-22FF2308-230B23202321237C239B-23B323DC-23E125B725C125F8-25FF266F27C0-27C427C7-27E527F0-27FF2900-29822999-29D729DC-29FB29FE-2AFF2B30-2B442B47-2B4CFB29FE62FE64-FE66FF0BFF1C-FF1EFF5CFF5EFFE2FFE9-FFEC",
        Sc: "002400A2-00A5058F060B09F209F309FB0AF10BF90E3F17DB20A0-20B9A838FDFCFE69FF04FFE0FFE1FFE5FFE6",
        Sk: "005E006000A800AF00B400B802C2-02C502D2-02DF02E5-02EB02ED02EF-02FF0375038403851FBD1FBF-1FC11FCD-1FCF1FDD-1FDF1FED-1FEF1FFD1FFE309B309CA700-A716A720A721A789A78AFBB2-FBC1FF3EFF40FFE3",
        So: "00A600A900AE00B00482060E060F06DE06E906FD06FE07F609FA0B700BF3-0BF80BFA0C7F0D790F01-0F030F130F15-0F170F1A-0F1F0F340F360F380FBE-0FC50FC7-0FCC0FCE0FCF0FD5-0FD8109E109F1390-1399194019DE-19FF1B61-1B6A1B74-1B7C210021012103-210621082109211421162117211E-2123212521272129212E213A213B214A214C214D214F2195-2199219C-219F21A121A221A421A521A7-21AD21AF-21CD21D021D121D321D5-21F32300-2307230C-231F2322-2328232B-237B237D-239A23B4-23DB23E2-23F32400-24262440-244A249C-24E92500-25B625B8-25C025C2-25F72600-266E2670-26FF2701-27672794-27BF2800-28FF2B00-2B2F2B452B462B50-2B592CE5-2CEA2E80-2E992E9B-2EF32F00-2FD52FF0-2FFB300430123013302030363037303E303F319031913196-319F31C0-31E33200-321E322A-324732503260-327F328A-32B032C0-32FE3300-33FF4DC0-4DFFA490-A4C6A828-A82BA836A837A839AA77-AA79FDFDFFE4FFE8FFEDFFEEFFFCFFFD",
        Z: "002000A01680180E2000-200A20282029202F205F3000",
        Zs: "002000A01680180E2000-200A202F205F3000",
        Zl: "2028",
        Zp: "2029",
        C: "0000-001F007F-009F00AD03780379037F-0383038B038D03A20528-05300557055805600588058B-058E059005C8-05CF05EB-05EF05F5-0605061C061D06DD070E070F074B074C07B2-07BF07FB-07FF082E082F083F085C085D085F-089F08A108AD-08E308FF097809800984098D098E0991099209A909B109B3-09B509BA09BB09C509C609C909CA09CF-09D609D8-09DB09DE09E409E509FC-0A000A040A0B-0A0E0A110A120A290A310A340A370A3A0A3B0A3D0A43-0A460A490A4A0A4E-0A500A52-0A580A5D0A5F-0A650A76-0A800A840A8E0A920AA90AB10AB40ABA0ABB0AC60ACA0ACE0ACF0AD1-0ADF0AE40AE50AF2-0B000B040B0D0B0E0B110B120B290B310B340B3A0B3B0B450B460B490B4A0B4E-0B550B58-0B5B0B5E0B640B650B78-0B810B840B8B-0B8D0B910B96-0B980B9B0B9D0BA0-0BA20BA5-0BA70BAB-0BAD0BBA-0BBD0BC3-0BC50BC90BCE0BCF0BD1-0BD60BD8-0BE50BFB-0C000C040C0D0C110C290C340C3A-0C3C0C450C490C4E-0C540C570C5A-0C5F0C640C650C70-0C770C800C810C840C8D0C910CA90CB40CBA0CBB0CC50CC90CCE-0CD40CD7-0CDD0CDF0CE40CE50CF00CF3-0D010D040D0D0D110D3B0D3C0D450D490D4F-0D560D58-0D5F0D640D650D76-0D780D800D810D840D97-0D990DB20DBC0DBE0DBF0DC7-0DC90DCB-0DCE0DD50DD70DE0-0DF10DF5-0E000E3B-0E3E0E5C-0E800E830E850E860E890E8B0E8C0E8E-0E930E980EA00EA40EA60EA80EA90EAC0EBA0EBE0EBF0EC50EC70ECE0ECF0EDA0EDB0EE0-0EFF0F480F6D-0F700F980FBD0FCD0FDB-0FFF10C610C8-10CC10CE10CF1249124E124F12571259125E125F1289128E128F12B112B612B712BF12C112C612C712D7131113161317135B135C137D-137F139A-139F13F5-13FF169D-169F16F1-16FF170D1715-171F1737-173F1754-175F176D17711774-177F17DE17DF17EA-17EF17FA-17FF180F181A-181F1878-187F18AB-18AF18F6-18FF191D-191F192C-192F193C-193F1941-1943196E196F1975-197F19AC-19AF19CA-19CF19DB-19DD1A1C1A1D1A5F1A7D1A7E1A8A-1A8F1A9A-1A9F1AAE-1AFF1B4C-1B4F1B7D-1B7F1BF4-1BFB1C38-1C3A1C4A-1C4C1C80-1CBF1CC8-1CCF1CF7-1CFF1DE7-1DFB1F161F171F1E1F1F1F461F471F4E1F4F1F581F5A1F5C1F5E1F7E1F7F1FB51FC51FD41FD51FDC1FF01FF11FF51FFF200B-200F202A-202E2060-206F20722073208F209D-209F20BA-20CF20F1-20FF218A-218F23F4-23FF2427-243F244B-245F27002B4D-2B4F2B5A-2BFF2C2F2C5F2CF4-2CF82D262D28-2D2C2D2E2D2F2D68-2D6E2D71-2D7E2D97-2D9F2DA72DAF2DB72DBF2DC72DCF2DD72DDF2E3C-2E7F2E9A2EF4-2EFF2FD6-2FEF2FFC-2FFF3040309730983100-3104312E-3130318F31BB-31BF31E4-31EF321F32FF4DB6-4DBF9FCD-9FFFA48D-A48FA4C7-A4CFA62C-A63FA698-A69EA6F8-A6FFA78FA794-A79FA7AB-A7F7A82C-A82FA83A-A83FA878-A87FA8C5-A8CDA8DA-A8DFA8FC-A8FFA954-A95EA97D-A97FA9CEA9DA-A9DDA9E0-A9FFAA37-AA3FAA4EAA4FAA5AAA5BAA7C-AA7FAAC3-AADAAAF7-AB00AB07AB08AB0FAB10AB17-AB1FAB27AB2F-ABBFABEEABEFABFA-ABFFD7A4-D7AFD7C7-D7CAD7FC-F8FFFA6EFA6FFADA-FAFFFB07-FB12FB18-FB1CFB37FB3DFB3FFB42FB45FBC2-FBD2FD40-FD4FFD90FD91FDC8-FDEFFDFEFDFFFE1A-FE1FFE27-FE2FFE53FE67FE6C-FE6FFE75FEFD-FF00FFBF-FFC1FFC8FFC9FFD0FFD1FFD8FFD9FFDD-FFDFFFE7FFEF-FFFBFFFEFFFF",
        Cc: "0000-001F007F-009F",
        Cf: "00AD0600-060406DD070F200B-200F202A-202E2060-2064206A-206FFEFFFFF9-FFFB",
        Co: "E000-F8FF",
        Cs: "D800-DFFF",
        Cn: "03780379037F-0383038B038D03A20528-05300557055805600588058B-058E059005C8-05CF05EB-05EF05F5-05FF0605061C061D070E074B074C07B2-07BF07FB-07FF082E082F083F085C085D085F-089F08A108AD-08E308FF097809800984098D098E0991099209A909B109B3-09B509BA09BB09C509C609C909CA09CF-09D609D8-09DB09DE09E409E509FC-0A000A040A0B-0A0E0A110A120A290A310A340A370A3A0A3B0A3D0A43-0A460A490A4A0A4E-0A500A52-0A580A5D0A5F-0A650A76-0A800A840A8E0A920AA90AB10AB40ABA0ABB0AC60ACA0ACE0ACF0AD1-0ADF0AE40AE50AF2-0B000B040B0D0B0E0B110B120B290B310B340B3A0B3B0B450B460B490B4A0B4E-0B550B58-0B5B0B5E0B640B650B78-0B810B840B8B-0B8D0B910B96-0B980B9B0B9D0BA0-0BA20BA5-0BA70BAB-0BAD0BBA-0BBD0BC3-0BC50BC90BCE0BCF0BD1-0BD60BD8-0BE50BFB-0C000C040C0D0C110C290C340C3A-0C3C0C450C490C4E-0C540C570C5A-0C5F0C640C650C70-0C770C800C810C840C8D0C910CA90CB40CBA0CBB0CC50CC90CCE-0CD40CD7-0CDD0CDF0CE40CE50CF00CF3-0D010D040D0D0D110D3B0D3C0D450D490D4F-0D560D58-0D5F0D640D650D76-0D780D800D810D840D97-0D990DB20DBC0DBE0DBF0DC7-0DC90DCB-0DCE0DD50DD70DE0-0DF10DF5-0E000E3B-0E3E0E5C-0E800E830E850E860E890E8B0E8C0E8E-0E930E980EA00EA40EA60EA80EA90EAC0EBA0EBE0EBF0EC50EC70ECE0ECF0EDA0EDB0EE0-0EFF0F480F6D-0F700F980FBD0FCD0FDB-0FFF10C610C8-10CC10CE10CF1249124E124F12571259125E125F1289128E128F12B112B612B712BF12C112C612C712D7131113161317135B135C137D-137F139A-139F13F5-13FF169D-169F16F1-16FF170D1715-171F1737-173F1754-175F176D17711774-177F17DE17DF17EA-17EF17FA-17FF180F181A-181F1878-187F18AB-18AF18F6-18FF191D-191F192C-192F193C-193F1941-1943196E196F1975-197F19AC-19AF19CA-19CF19DB-19DD1A1C1A1D1A5F1A7D1A7E1A8A-1A8F1A9A-1A9F1AAE-1AFF1B4C-1B4F1B7D-1B7F1BF4-1BFB1C38-1C3A1C4A-1C4C1C80-1CBF1CC8-1CCF1CF7-1CFF1DE7-1DFB1F161F171F1E1F1F1F461F471F4E1F4F1F581F5A1F5C1F5E1F7E1F7F1FB51FC51FD41FD51FDC1FF01FF11FF51FFF2065-206920722073208F209D-209F20BA-20CF20F1-20FF218A-218F23F4-23FF2427-243F244B-245F27002B4D-2B4F2B5A-2BFF2C2F2C5F2CF4-2CF82D262D28-2D2C2D2E2D2F2D68-2D6E2D71-2D7E2D97-2D9F2DA72DAF2DB72DBF2DC72DCF2DD72DDF2E3C-2E7F2E9A2EF4-2EFF2FD6-2FEF2FFC-2FFF3040309730983100-3104312E-3130318F31BB-31BF31E4-31EF321F32FF4DB6-4DBF9FCD-9FFFA48D-A48FA4C7-A4CFA62C-A63FA698-A69EA6F8-A6FFA78FA794-A79FA7AB-A7F7A82C-A82FA83A-A83FA878-A87FA8C5-A8CDA8DA-A8DFA8FC-A8FFA954-A95EA97D-A97FA9CEA9DA-A9DDA9E0-A9FFAA37-AA3FAA4EAA4FAA5AAA5BAA7C-AA7FAAC3-AADAAAF7-AB00AB07AB08AB0FAB10AB17-AB1FAB27AB2F-ABBFABEEABEFABFA-ABFFD7A4-D7AFD7C7-D7CAD7FC-D7FFFA6EFA6FFADA-FAFFFB07-FB12FB18-FB1CFB37FB3DFB3FFB42FB45FBC2-FBD2FD40-FD4FFD90FD91FDC8-FDEFFDFEFDFFFE1A-FE1FFE27-FE2FFE53FE67FE6C-FE6FFE75FEFDFEFEFF00FFBF-FFC1FFC8FFC9FFD0FFD1FFD8FFD9FFDD-FFDFFFE7FFEF-FFF8FFFEFFFF"
    }, {
        //L: "Letter", // Included in the Unicode Base addon
        Ll: "Lowercase_Letter",
        Lu: "Uppercase_Letter",
        Lt: "Titlecase_Letter",
        Lm: "Modifier_Letter",
        Lo: "Other_Letter",
        M: "Mark",
        Mn: "Nonspacing_Mark",
        Mc: "Spacing_Mark",
        Me: "Enclosing_Mark",
        N: "Number",
        Nd: "Decimal_Number",
        Nl: "Letter_Number",
        No: "Other_Number",
        P: "Punctuation",
        Pd: "Dash_Punctuation",
        Ps: "Open_Punctuation",
        Pe: "Close_Punctuation",
        Pi: "Initial_Punctuation",
        Pf: "Final_Punctuation",
        Pc: "Connector_Punctuation",
        Po: "Other_Punctuation",
        S: "Symbol",
        Sm: "Math_Symbol",
        Sc: "Currency_Symbol",
        Sk: "Modifier_Symbol",
        So: "Other_Symbol",
        Z: "Separator",
        Zs: "Space_Separator",
        Zl: "Line_Separator",
        Zp: "Paragraph_Separator",
        C: "Other",
        Cc: "Control",
        Cf: "Format",
        Co: "Private_Use",
        Cs: "Surrogate",
        Cn: "Unassigned"
    });

}(XRegExp));


/***** unicode-scripts.js *****/

/*!
 * XRegExp Unicode Scripts v1.2.0
 * (c) 2010-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Uses Unicode 6.1 <http://unicode.org/>
 */

/**
 * Adds support for all Unicode scripts in the Basic Multilingual Plane (U+0000-U+FFFF).
 * E.g., `\p{Latin}`. Token names are case insensitive, and any spaces, hyphens, and underscores
 * are ignored.
 * @requires XRegExp, XRegExp Unicode Base
 */
(function (XRegExp) {
    "use strict";

    if (!XRegExp.addUnicodePackage) {
        throw new ReferenceError("Unicode Base must be loaded before Unicode Scripts");
    }

    XRegExp.install("extensibility");

    XRegExp.addUnicodePackage({
        Arabic: "0600-06040606-060B060D-061A061E0620-063F0641-064A0656-065E066A-066F0671-06DC06DE-06FF0750-077F08A008A2-08AC08E4-08FEFB50-FBC1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFCFE70-FE74FE76-FEFC",
        Armenian: "0531-05560559-055F0561-0587058A058FFB13-FB17",
        Balinese: "1B00-1B4B1B50-1B7C",
        Bamum: "A6A0-A6F7",
        Batak: "1BC0-1BF31BFC-1BFF",
        Bengali: "0981-09830985-098C098F09900993-09A809AA-09B009B209B6-09B909BC-09C409C709C809CB-09CE09D709DC09DD09DF-09E309E6-09FB",
        Bopomofo: "02EA02EB3105-312D31A0-31BA",
        Braille: "2800-28FF",
        Buginese: "1A00-1A1B1A1E1A1F",
        Buhid: "1740-1753",
        Canadian_Aboriginal: "1400-167F18B0-18F5",
        Cham: "AA00-AA36AA40-AA4DAA50-AA59AA5C-AA5F",
        Cherokee: "13A0-13F4",
        Common: "0000-0040005B-0060007B-00A900AB-00B900BB-00BF00D700F702B9-02DF02E5-02E902EC-02FF0374037E038503870589060C061B061F06400660-066906DD096409650E3F0FD5-0FD810FB16EB-16ED173517361802180318051CD31CE11CE9-1CEC1CEE-1CF31CF51CF62000-200B200E-2064206A-20702074-207E2080-208E20A0-20B92100-21252127-2129212C-21312133-214D214F-215F21892190-23F32400-24262440-244A2460-26FF2701-27FF2900-2B4C2B50-2B592E00-2E3B2FF0-2FFB3000-300430063008-30203030-3037303C-303F309B309C30A030FB30FC3190-319F31C0-31E33220-325F327F-32CF3358-33FF4DC0-4DFFA700-A721A788-A78AA830-A839FD3EFD3FFDFDFE10-FE19FE30-FE52FE54-FE66FE68-FE6BFEFFFF01-FF20FF3B-FF40FF5B-FF65FF70FF9EFF9FFFE0-FFE6FFE8-FFEEFFF9-FFFD",
        Coptic: "03E2-03EF2C80-2CF32CF9-2CFF",
        Cyrillic: "0400-04840487-05271D2B1D782DE0-2DFFA640-A697A69F",
        Devanagari: "0900-09500953-09630966-09770979-097FA8E0-A8FB",
        Ethiopic: "1200-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A135D-137C1380-13992D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDEAB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2E",
        Georgian: "10A0-10C510C710CD10D0-10FA10FC-10FF2D00-2D252D272D2D",
        Glagolitic: "2C00-2C2E2C30-2C5E",
        Greek: "0370-03730375-0377037A-037D038403860388-038A038C038E-03A103A3-03E103F0-03FF1D26-1D2A1D5D-1D611D66-1D6A1DBF1F00-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FC41FC6-1FD31FD6-1FDB1FDD-1FEF1FF2-1FF41FF6-1FFE2126",
        Gujarati: "0A81-0A830A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABC-0AC50AC7-0AC90ACB-0ACD0AD00AE0-0AE30AE6-0AF1",
        Gurmukhi: "0A01-0A030A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A3C0A3E-0A420A470A480A4B-0A4D0A510A59-0A5C0A5E0A66-0A75",
        Han: "2E80-2E992E9B-2EF32F00-2FD5300530073021-30293038-303B3400-4DB54E00-9FCCF900-FA6DFA70-FAD9",
        Hangul: "1100-11FF302E302F3131-318E3200-321E3260-327EA960-A97CAC00-D7A3D7B0-D7C6D7CB-D7FBFFA0-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
        Hanunoo: "1720-1734",
        Hebrew: "0591-05C705D0-05EA05F0-05F4FB1D-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FB4F",
        Hiragana: "3041-3096309D-309F",
        Inherited: "0300-036F04850486064B-0655065F0670095109521CD0-1CD21CD4-1CE01CE2-1CE81CED1CF41DC0-1DE61DFC-1DFF200C200D20D0-20F0302A-302D3099309AFE00-FE0FFE20-FE26",
        Javanese: "A980-A9CDA9CF-A9D9A9DEA9DF",
        Kannada: "0C820C830C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBC-0CC40CC6-0CC80CCA-0CCD0CD50CD60CDE0CE0-0CE30CE6-0CEF0CF10CF2",
        Katakana: "30A1-30FA30FD-30FF31F0-31FF32D0-32FE3300-3357FF66-FF6FFF71-FF9D",
        Kayah_Li: "A900-A92F",
        Khmer: "1780-17DD17E0-17E917F0-17F919E0-19FF",
        Lao: "0E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB90EBB-0EBD0EC0-0EC40EC60EC8-0ECD0ED0-0ED90EDC-0EDF",
        Latin: "0041-005A0061-007A00AA00BA00C0-00D600D8-00F600F8-02B802E0-02E41D00-1D251D2C-1D5C1D62-1D651D6B-1D771D79-1DBE1E00-1EFF2071207F2090-209C212A212B2132214E2160-21882C60-2C7FA722-A787A78B-A78EA790-A793A7A0-A7AAA7F8-A7FFFB00-FB06FF21-FF3AFF41-FF5A",
        Lepcha: "1C00-1C371C3B-1C491C4D-1C4F",
        Limbu: "1900-191C1920-192B1930-193B19401944-194F",
        Lisu: "A4D0-A4FF",
        Malayalam: "0D020D030D05-0D0C0D0E-0D100D12-0D3A0D3D-0D440D46-0D480D4A-0D4E0D570D60-0D630D66-0D750D79-0D7F",
        Mandaic: "0840-085B085E",
        Meetei_Mayek: "AAE0-AAF6ABC0-ABEDABF0-ABF9",
        Mongolian: "1800180118041806-180E1810-18191820-18771880-18AA",
        Myanmar: "1000-109FAA60-AA7B",
        New_Tai_Lue: "1980-19AB19B0-19C919D0-19DA19DE19DF",
        Nko: "07C0-07FA",
        Ogham: "1680-169C",
        Ol_Chiki: "1C50-1C7F",
        Oriya: "0B01-0B030B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3C-0B440B470B480B4B-0B4D0B560B570B5C0B5D0B5F-0B630B66-0B77",
        Phags_Pa: "A840-A877",
        Rejang: "A930-A953A95F",
        Runic: "16A0-16EA16EE-16F0",
        Samaritan: "0800-082D0830-083E",
        Saurashtra: "A880-A8C4A8CE-A8D9",
        Sinhala: "0D820D830D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60DCA0DCF-0DD40DD60DD8-0DDF0DF2-0DF4",
        Sundanese: "1B80-1BBF1CC0-1CC7",
        Syloti_Nagri: "A800-A82B",
        Syriac: "0700-070D070F-074A074D-074F",
        Tagalog: "1700-170C170E-1714",
        Tagbanwa: "1760-176C176E-177017721773",
        Tai_Le: "1950-196D1970-1974",
        Tai_Tham: "1A20-1A5E1A60-1A7C1A7F-1A891A90-1A991AA0-1AAD",
        Tai_Viet: "AA80-AAC2AADB-AADF",
        Tamil: "0B820B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BBE-0BC20BC6-0BC80BCA-0BCD0BD00BD70BE6-0BFA",
        Telugu: "0C01-0C030C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D-0C440C46-0C480C4A-0C4D0C550C560C580C590C60-0C630C66-0C6F0C78-0C7F",
        Thaana: "0780-07B1",
        Thai: "0E01-0E3A0E40-0E5B",
        Tibetan: "0F00-0F470F49-0F6C0F71-0F970F99-0FBC0FBE-0FCC0FCE-0FD40FD90FDA",
        Tifinagh: "2D30-2D672D6F2D702D7F",
        Vai: "A500-A62B",
        Yi: "A000-A48CA490-A4C6"
    });

}(XRegExp));


/***** unicode-blocks.js *****/

/*!
 * XRegExp Unicode Blocks v1.2.0
 * (c) 2010-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Uses Unicode 6.1 <http://unicode.org/>
 */

/**
 * Adds support for all Unicode blocks in the Basic Multilingual Plane (U+0000-U+FFFF). Unicode
 * blocks use the prefix "In". E.g., `\p{InBasicLatin}`. Token names are case insensitive, and any
 * spaces, hyphens, and underscores are ignored.
 * @requires XRegExp, XRegExp Unicode Base
 */
(function (XRegExp) {
    "use strict";

    if (!XRegExp.addUnicodePackage) {
        throw new ReferenceError("Unicode Base must be loaded before Unicode Blocks");
    }

    XRegExp.install("extensibility");

    XRegExp.addUnicodePackage({
        InBasic_Latin: "0000-007F",
        InLatin_1_Supplement: "0080-00FF",
        InLatin_Extended_A: "0100-017F",
        InLatin_Extended_B: "0180-024F",
        InIPA_Extensions: "0250-02AF",
        InSpacing_Modifier_Letters: "02B0-02FF",
        InCombining_Diacritical_Marks: "0300-036F",
        InGreek_and_Coptic: "0370-03FF",
        InCyrillic: "0400-04FF",
        InCyrillic_Supplement: "0500-052F",
        InArmenian: "0530-058F",
        InHebrew: "0590-05FF",
        InArabic: "0600-06FF",
        InSyriac: "0700-074F",
        InArabic_Supplement: "0750-077F",
        InThaana: "0780-07BF",
        InNKo: "07C0-07FF",
        InSamaritan: "0800-083F",
        InMandaic: "0840-085F",
        InArabic_Extended_A: "08A0-08FF",
        InDevanagari: "0900-097F",
        InBengali: "0980-09FF",
        InGurmukhi: "0A00-0A7F",
        InGujarati: "0A80-0AFF",
        InOriya: "0B00-0B7F",
        InTamil: "0B80-0BFF",
        InTelugu: "0C00-0C7F",
        InKannada: "0C80-0CFF",
        InMalayalam: "0D00-0D7F",
        InSinhala: "0D80-0DFF",
        InThai: "0E00-0E7F",
        InLao: "0E80-0EFF",
        InTibetan: "0F00-0FFF",
        InMyanmar: "1000-109F",
        InGeorgian: "10A0-10FF",
        InHangul_Jamo: "1100-11FF",
        InEthiopic: "1200-137F",
        InEthiopic_Supplement: "1380-139F",
        InCherokee: "13A0-13FF",
        InUnified_Canadian_Aboriginal_Syllabics: "1400-167F",
        InOgham: "1680-169F",
        InRunic: "16A0-16FF",
        InTagalog: "1700-171F",
        InHanunoo: "1720-173F",
        InBuhid: "1740-175F",
        InTagbanwa: "1760-177F",
        InKhmer: "1780-17FF",
        InMongolian: "1800-18AF",
        InUnified_Canadian_Aboriginal_Syllabics_Extended: "18B0-18FF",
        InLimbu: "1900-194F",
        InTai_Le: "1950-197F",
        InNew_Tai_Lue: "1980-19DF",
        InKhmer_Symbols: "19E0-19FF",
        InBuginese: "1A00-1A1F",
        InTai_Tham: "1A20-1AAF",
        InBalinese: "1B00-1B7F",
        InSundanese: "1B80-1BBF",
        InBatak: "1BC0-1BFF",
        InLepcha: "1C00-1C4F",
        InOl_Chiki: "1C50-1C7F",
        InSundanese_Supplement: "1CC0-1CCF",
        InVedic_Extensions: "1CD0-1CFF",
        InPhonetic_Extensions: "1D00-1D7F",
        InPhonetic_Extensions_Supplement: "1D80-1DBF",
        InCombining_Diacritical_Marks_Supplement: "1DC0-1DFF",
        InLatin_Extended_Additional: "1E00-1EFF",
        InGreek_Extended: "1F00-1FFF",
        InGeneral_Punctuation: "2000-206F",
        InSuperscripts_and_Subscripts: "2070-209F",
        InCurrency_Symbols: "20A0-20CF",
        InCombining_Diacritical_Marks_for_Symbols: "20D0-20FF",
        InLetterlike_Symbols: "2100-214F",
        InNumber_Forms: "2150-218F",
        InArrows: "2190-21FF",
        InMathematical_Operators: "2200-22FF",
        InMiscellaneous_Technical: "2300-23FF",
        InControl_Pictures: "2400-243F",
        InOptical_Character_Recognition: "2440-245F",
        InEnclosed_Alphanumerics: "2460-24FF",
        InBox_Drawing: "2500-257F",
        InBlock_Elements: "2580-259F",
        InGeometric_Shapes: "25A0-25FF",
        InMiscellaneous_Symbols: "2600-26FF",
        InDingbats: "2700-27BF",
        InMiscellaneous_Mathematical_Symbols_A: "27C0-27EF",
        InSupplemental_Arrows_A: "27F0-27FF",
        InBraille_Patterns: "2800-28FF",
        InSupplemental_Arrows_B: "2900-297F",
        InMiscellaneous_Mathematical_Symbols_B: "2980-29FF",
        InSupplemental_Mathematical_Operators: "2A00-2AFF",
        InMiscellaneous_Symbols_and_Arrows: "2B00-2BFF",
        InGlagolitic: "2C00-2C5F",
        InLatin_Extended_C: "2C60-2C7F",
        InCoptic: "2C80-2CFF",
        InGeorgian_Supplement: "2D00-2D2F",
        InTifinagh: "2D30-2D7F",
        InEthiopic_Extended: "2D80-2DDF",
        InCyrillic_Extended_A: "2DE0-2DFF",
        InSupplemental_Punctuation: "2E00-2E7F",
        InCJK_Radicals_Supplement: "2E80-2EFF",
        InKangxi_Radicals: "2F00-2FDF",
        InIdeographic_Description_Characters: "2FF0-2FFF",
        InCJK_Symbols_and_Punctuation: "3000-303F",
        InHiragana: "3040-309F",
        InKatakana: "30A0-30FF",
        InBopomofo: "3100-312F",
        InHangul_Compatibility_Jamo: "3130-318F",
        InKanbun: "3190-319F",
        InBopomofo_Extended: "31A0-31BF",
        InCJK_Strokes: "31C0-31EF",
        InKatakana_Phonetic_Extensions: "31F0-31FF",
        InEnclosed_CJK_Letters_and_Months: "3200-32FF",
        InCJK_Compatibility: "3300-33FF",
        InCJK_Unified_Ideographs_Extension_A: "3400-4DBF",
        InYijing_Hexagram_Symbols: "4DC0-4DFF",
        InCJK_Unified_Ideographs: "4E00-9FFF",
        InYi_Syllables: "A000-A48F",
        InYi_Radicals: "A490-A4CF",
        InLisu: "A4D0-A4FF",
        InVai: "A500-A63F",
        InCyrillic_Extended_B: "A640-A69F",
        InBamum: "A6A0-A6FF",
        InModifier_Tone_Letters: "A700-A71F",
        InLatin_Extended_D: "A720-A7FF",
        InSyloti_Nagri: "A800-A82F",
        InCommon_Indic_Number_Forms: "A830-A83F",
        InPhags_pa: "A840-A87F",
        InSaurashtra: "A880-A8DF",
        InDevanagari_Extended: "A8E0-A8FF",
        InKayah_Li: "A900-A92F",
        InRejang: "A930-A95F",
        InHangul_Jamo_Extended_A: "A960-A97F",
        InJavanese: "A980-A9DF",
        InCham: "AA00-AA5F",
        InMyanmar_Extended_A: "AA60-AA7F",
        InTai_Viet: "AA80-AADF",
        InMeetei_Mayek_Extensions: "AAE0-AAFF",
        InEthiopic_Extended_A: "AB00-AB2F",
        InMeetei_Mayek: "ABC0-ABFF",
        InHangul_Syllables: "AC00-D7AF",
        InHangul_Jamo_Extended_B: "D7B0-D7FF",
        InHigh_Surrogates: "D800-DB7F",
        InHigh_Private_Use_Surrogates: "DB80-DBFF",
        InLow_Surrogates: "DC00-DFFF",
        InPrivate_Use_Area: "E000-F8FF",
        InCJK_Compatibility_Ideographs: "F900-FAFF",
        InAlphabetic_Presentation_Forms: "FB00-FB4F",
        InArabic_Presentation_Forms_A: "FB50-FDFF",
        InVariation_Selectors: "FE00-FE0F",
        InVertical_Forms: "FE10-FE1F",
        InCombining_Half_Marks: "FE20-FE2F",
        InCJK_Compatibility_Forms: "FE30-FE4F",
        InSmall_Form_Variants: "FE50-FE6F",
        InArabic_Presentation_Forms_B: "FE70-FEFF",
        InHalfwidth_and_Fullwidth_Forms: "FF00-FFEF",
        InSpecials: "FFF0-FFFF"
    });

}(XRegExp));


/***** unicode-properties.js *****/

/*!
 * XRegExp Unicode Properties v1.0.0
 * (c) 2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Uses Unicode 6.1 <http://unicode.org/>
 */

/**
 * Adds Unicode properties necessary to meet Level 1 Unicode support (detailed in UTS#18 RL1.2).
 * Includes code points from the Basic Multilingual Plane (U+0000-U+FFFF) only. Token names are
 * case insensitive, and any spaces, hyphens, and underscores are ignored.
 * @requires XRegExp, XRegExp Unicode Base
 */
(function (XRegExp) {
    "use strict";

    if (!XRegExp.addUnicodePackage) {
        throw new ReferenceError("Unicode Base must be loaded before Unicode Properties");
    }

    XRegExp.install("extensibility");

    XRegExp.addUnicodePackage({
        Alphabetic: "0041-005A0061-007A00AA00B500BA00C0-00D600D8-00F600F8-02C102C6-02D102E0-02E402EC02EE03450370-037403760377037A-037D03860388-038A038C038E-03A103A3-03F503F7-0481048A-05270531-055605590561-058705B0-05BD05BF05C105C205C405C505C705D0-05EA05F0-05F20610-061A0620-06570659-065F066E-06D306D5-06DC06E1-06E806ED-06EF06FA-06FC06FF0710-073F074D-07B107CA-07EA07F407F507FA0800-0817081A-082C0840-085808A008A2-08AC08E4-08E908F0-08FE0900-093B093D-094C094E-09500955-09630971-09770979-097F0981-09830985-098C098F09900993-09A809AA-09B009B209B6-09B909BD-09C409C709C809CB09CC09CE09D709DC09DD09DF-09E309F009F10A01-0A030A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A3E-0A420A470A480A4B0A4C0A510A59-0A5C0A5E0A70-0A750A81-0A830A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD-0AC50AC7-0AC90ACB0ACC0AD00AE0-0AE30B01-0B030B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D-0B440B470B480B4B0B4C0B560B570B5C0B5D0B5F-0B630B710B820B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BBE-0BC20BC6-0BC80BCA-0BCC0BD00BD70C01-0C030C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D-0C440C46-0C480C4A-0C4C0C550C560C580C590C60-0C630C820C830C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD-0CC40CC6-0CC80CCA-0CCC0CD50CD60CDE0CE0-0CE30CF10CF20D020D030D05-0D0C0D0E-0D100D12-0D3A0D3D-0D440D46-0D480D4A-0D4C0D4E0D570D60-0D630D7A-0D7F0D820D830D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60DCF-0DD40DD60DD8-0DDF0DF20DF30E01-0E3A0E40-0E460E4D0E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB90EBB-0EBD0EC0-0EC40EC60ECD0EDC-0EDF0F000F40-0F470F49-0F6C0F71-0F810F88-0F970F99-0FBC1000-10361038103B-103F1050-10621065-1068106E-1086108E109C109D10A0-10C510C710CD10D0-10FA10FC-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A135F1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA16EE-16F01700-170C170E-17131720-17331740-17531760-176C176E-1770177217731780-17B317B6-17C817D717DC1820-18771880-18AA18B0-18F51900-191C1920-192B1930-19381950-196D1970-19741980-19AB19B0-19C91A00-1A1B1A20-1A5E1A61-1A741AA71B00-1B331B35-1B431B45-1B4B1B80-1BA91BAC-1BAF1BBA-1BE51BE7-1BF11C00-1C351C4D-1C4F1C5A-1C7D1CE9-1CEC1CEE-1CF31CF51CF61D00-1DBF1E00-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FBC1FBE1FC2-1FC41FC6-1FCC1FD0-1FD31FD6-1FDB1FE0-1FEC1FF2-1FF41FF6-1FFC2071207F2090-209C21022107210A-211321152119-211D212421262128212A-212D212F-2139213C-213F2145-2149214E2160-218824B6-24E92C00-2C2E2C30-2C5E2C60-2CE42CEB-2CEE2CF22CF32D00-2D252D272D2D2D30-2D672D6F2D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE2DE0-2DFF2E2F3005-30073021-30293031-30353038-303C3041-3096309D-309F30A1-30FA30FC-30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A48CA4D0-A4FDA500-A60CA610-A61FA62AA62BA640-A66EA674-A67BA67F-A697A69F-A6EFA717-A71FA722-A788A78B-A78EA790-A793A7A0-A7AAA7F8-A801A803-A805A807-A80AA80C-A827A840-A873A880-A8C3A8F2-A8F7A8FBA90A-A92AA930-A952A960-A97CA980-A9B2A9B4-A9BFA9CFAA00-AA36AA40-AA4DAA60-AA76AA7AAA80-AABEAAC0AAC2AADB-AADDAAE0-AAEFAAF2-AAF5AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABEAAC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB00-FB06FB13-FB17FB1D-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF21-FF3AFF41-FF5AFF66-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
        Uppercase: "0041-005A00C0-00D600D8-00DE01000102010401060108010A010C010E01100112011401160118011A011C011E01200122012401260128012A012C012E01300132013401360139013B013D013F0141014301450147014A014C014E01500152015401560158015A015C015E01600162016401660168016A016C016E017001720174017601780179017B017D018101820184018601870189-018B018E-0191019301940196-0198019C019D019F01A001A201A401A601A701A901AC01AE01AF01B1-01B301B501B701B801BC01C401C701CA01CD01CF01D101D301D501D701D901DB01DE01E001E201E401E601E801EA01EC01EE01F101F401F6-01F801FA01FC01FE02000202020402060208020A020C020E02100212021402160218021A021C021E02200222022402260228022A022C022E02300232023A023B023D023E02410243-02460248024A024C024E03700372037603860388-038A038C038E038F0391-03A103A3-03AB03CF03D2-03D403D803DA03DC03DE03E003E203E403E603E803EA03EC03EE03F403F703F903FA03FD-042F04600462046404660468046A046C046E04700472047404760478047A047C047E0480048A048C048E04900492049404960498049A049C049E04A004A204A404A604A804AA04AC04AE04B004B204B404B604B804BA04BC04BE04C004C104C304C504C704C904CB04CD04D004D204D404D604D804DA04DC04DE04E004E204E404E604E804EA04EC04EE04F004F204F404F604F804FA04FC04FE05000502050405060508050A050C050E05100512051405160518051A051C051E05200522052405260531-055610A0-10C510C710CD1E001E021E041E061E081E0A1E0C1E0E1E101E121E141E161E181E1A1E1C1E1E1E201E221E241E261E281E2A1E2C1E2E1E301E321E341E361E381E3A1E3C1E3E1E401E421E441E461E481E4A1E4C1E4E1E501E521E541E561E581E5A1E5C1E5E1E601E621E641E661E681E6A1E6C1E6E1E701E721E741E761E781E7A1E7C1E7E1E801E821E841E861E881E8A1E8C1E8E1E901E921E941E9E1EA01EA21EA41EA61EA81EAA1EAC1EAE1EB01EB21EB41EB61EB81EBA1EBC1EBE1EC01EC21EC41EC61EC81ECA1ECC1ECE1ED01ED21ED41ED61ED81EDA1EDC1EDE1EE01EE21EE41EE61EE81EEA1EEC1EEE1EF01EF21EF41EF61EF81EFA1EFC1EFE1F08-1F0F1F18-1F1D1F28-1F2F1F38-1F3F1F48-1F4D1F591F5B1F5D1F5F1F68-1F6F1FB8-1FBB1FC8-1FCB1FD8-1FDB1FE8-1FEC1FF8-1FFB21022107210B-210D2110-211221152119-211D212421262128212A-212D2130-2133213E213F21452160-216F218324B6-24CF2C00-2C2E2C602C62-2C642C672C692C6B2C6D-2C702C722C752C7E-2C802C822C842C862C882C8A2C8C2C8E2C902C922C942C962C982C9A2C9C2C9E2CA02CA22CA42CA62CA82CAA2CAC2CAE2CB02CB22CB42CB62CB82CBA2CBC2CBE2CC02CC22CC42CC62CC82CCA2CCC2CCE2CD02CD22CD42CD62CD82CDA2CDC2CDE2CE02CE22CEB2CED2CF2A640A642A644A646A648A64AA64CA64EA650A652A654A656A658A65AA65CA65EA660A662A664A666A668A66AA66CA680A682A684A686A688A68AA68CA68EA690A692A694A696A722A724A726A728A72AA72CA72EA732A734A736A738A73AA73CA73EA740A742A744A746A748A74AA74CA74EA750A752A754A756A758A75AA75CA75EA760A762A764A766A768A76AA76CA76EA779A77BA77DA77EA780A782A784A786A78BA78DA790A792A7A0A7A2A7A4A7A6A7A8A7AAFF21-FF3A",
        Lowercase: "0061-007A00AA00B500BA00DF-00F600F8-00FF01010103010501070109010B010D010F01110113011501170119011B011D011F01210123012501270129012B012D012F01310133013501370138013A013C013E014001420144014601480149014B014D014F01510153015501570159015B015D015F01610163016501670169016B016D016F0171017301750177017A017C017E-0180018301850188018C018D019201950199-019B019E01A101A301A501A801AA01AB01AD01B001B401B601B901BA01BD-01BF01C601C901CC01CE01D001D201D401D601D801DA01DC01DD01DF01E101E301E501E701E901EB01ED01EF01F001F301F501F901FB01FD01FF02010203020502070209020B020D020F02110213021502170219021B021D021F02210223022502270229022B022D022F02310233-0239023C023F0240024202470249024B024D024F-02930295-02B802C002C102E0-02E40345037103730377037A-037D039003AC-03CE03D003D103D5-03D703D903DB03DD03DF03E103E303E503E703E903EB03ED03EF-03F303F503F803FB03FC0430-045F04610463046504670469046B046D046F04710473047504770479047B047D047F0481048B048D048F04910493049504970499049B049D049F04A104A304A504A704A904AB04AD04AF04B104B304B504B704B904BB04BD04BF04C204C404C604C804CA04CC04CE04CF04D104D304D504D704D904DB04DD04DF04E104E304E504E704E904EB04ED04EF04F104F304F504F704F904FB04FD04FF05010503050505070509050B050D050F05110513051505170519051B051D051F05210523052505270561-05871D00-1DBF1E011E031E051E071E091E0B1E0D1E0F1E111E131E151E171E191E1B1E1D1E1F1E211E231E251E271E291E2B1E2D1E2F1E311E331E351E371E391E3B1E3D1E3F1E411E431E451E471E491E4B1E4D1E4F1E511E531E551E571E591E5B1E5D1E5F1E611E631E651E671E691E6B1E6D1E6F1E711E731E751E771E791E7B1E7D1E7F1E811E831E851E871E891E8B1E8D1E8F1E911E931E95-1E9D1E9F1EA11EA31EA51EA71EA91EAB1EAD1EAF1EB11EB31EB51EB71EB91EBB1EBD1EBF1EC11EC31EC51EC71EC91ECB1ECD1ECF1ED11ED31ED51ED71ED91EDB1EDD1EDF1EE11EE31EE51EE71EE91EEB1EED1EEF1EF11EF31EF51EF71EF91EFB1EFD1EFF-1F071F10-1F151F20-1F271F30-1F371F40-1F451F50-1F571F60-1F671F70-1F7D1F80-1F871F90-1F971FA0-1FA71FB0-1FB41FB61FB71FBE1FC2-1FC41FC61FC71FD0-1FD31FD61FD71FE0-1FE71FF2-1FF41FF61FF72071207F2090-209C210A210E210F2113212F21342139213C213D2146-2149214E2170-217F218424D0-24E92C30-2C5E2C612C652C662C682C6A2C6C2C712C732C742C76-2C7D2C812C832C852C872C892C8B2C8D2C8F2C912C932C952C972C992C9B2C9D2C9F2CA12CA32CA52CA72CA92CAB2CAD2CAF2CB12CB32CB52CB72CB92CBB2CBD2CBF2CC12CC32CC52CC72CC92CCB2CCD2CCF2CD12CD32CD52CD72CD92CDB2CDD2CDF2CE12CE32CE42CEC2CEE2CF32D00-2D252D272D2DA641A643A645A647A649A64BA64DA64FA651A653A655A657A659A65BA65DA65FA661A663A665A667A669A66BA66DA681A683A685A687A689A68BA68DA68FA691A693A695A697A723A725A727A729A72BA72DA72F-A731A733A735A737A739A73BA73DA73FA741A743A745A747A749A74BA74DA74FA751A753A755A757A759A75BA75DA75FA761A763A765A767A769A76BA76DA76F-A778A77AA77CA77FA781A783A785A787A78CA78EA791A793A7A1A7A3A7A5A7A7A7A9A7F8-A7FAFB00-FB06FB13-FB17FF41-FF5A",
        White_Space: "0009-000D0020008500A01680180E2000-200A20282029202F205F3000",
        Noncharacter_Code_Point: "FDD0-FDEFFFFEFFFF",
        Default_Ignorable_Code_Point: "00AD034F115F116017B417B5180B-180D200B-200F202A-202E2060-206F3164FE00-FE0FFEFFFFA0FFF0-FFF8",
        // \p{Any} matches a code unit. To match any code point via surrogate pairs, use (?:[\0-\uD7FF\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF])
        Any: "0000-FFFF", // \p{^Any} compiles to [^\u0000-\uFFFF]; [\p{^Any}] to []
        Ascii: "0000-007F",
        // \p{Assigned} is equivalent to \p{^Cn}
        //Assigned: XRegExp("[\\p{^Cn}]").source.replace(/[[\]]|\\u/g, "") // Negation inside a character class triggers inversion
        Assigned: "0000-0377037A-037E0384-038A038C038E-03A103A3-05270531-05560559-055F0561-05870589058A058F0591-05C705D0-05EA05F0-05F40600-06040606-061B061E-070D070F-074A074D-07B107C0-07FA0800-082D0830-083E0840-085B085E08A008A2-08AC08E4-08FE0900-09770979-097F0981-09830985-098C098F09900993-09A809AA-09B009B209B6-09B909BC-09C409C709C809CB-09CE09D709DC09DD09DF-09E309E6-09FB0A01-0A030A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A3C0A3E-0A420A470A480A4B-0A4D0A510A59-0A5C0A5E0A66-0A750A81-0A830A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABC-0AC50AC7-0AC90ACB-0ACD0AD00AE0-0AE30AE6-0AF10B01-0B030B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3C-0B440B470B480B4B-0B4D0B560B570B5C0B5D0B5F-0B630B66-0B770B820B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BBE-0BC20BC6-0BC80BCA-0BCD0BD00BD70BE6-0BFA0C01-0C030C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D-0C440C46-0C480C4A-0C4D0C550C560C580C590C60-0C630C66-0C6F0C78-0C7F0C820C830C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBC-0CC40CC6-0CC80CCA-0CCD0CD50CD60CDE0CE0-0CE30CE6-0CEF0CF10CF20D020D030D05-0D0C0D0E-0D100D12-0D3A0D3D-0D440D46-0D480D4A-0D4E0D570D60-0D630D66-0D750D79-0D7F0D820D830D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60DCA0DCF-0DD40DD60DD8-0DDF0DF2-0DF40E01-0E3A0E3F-0E5B0E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB90EBB-0EBD0EC0-0EC40EC60EC8-0ECD0ED0-0ED90EDC-0EDF0F00-0F470F49-0F6C0F71-0F970F99-0FBC0FBE-0FCC0FCE-0FDA1000-10C510C710CD10D0-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A135D-137C1380-139913A0-13F41400-169C16A0-16F01700-170C170E-17141720-17361740-17531760-176C176E-1770177217731780-17DD17E0-17E917F0-17F91800-180E1810-18191820-18771880-18AA18B0-18F51900-191C1920-192B1930-193B19401944-196D1970-19741980-19AB19B0-19C919D0-19DA19DE-1A1B1A1E-1A5E1A60-1A7C1A7F-1A891A90-1A991AA0-1AAD1B00-1B4B1B50-1B7C1B80-1BF31BFC-1C371C3B-1C491C4D-1C7F1CC0-1CC71CD0-1CF61D00-1DE61DFC-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FC41FC6-1FD31FD6-1FDB1FDD-1FEF1FF2-1FF41FF6-1FFE2000-2064206A-20712074-208E2090-209C20A0-20B920D0-20F02100-21892190-23F32400-24262440-244A2460-26FF2701-2B4C2B50-2B592C00-2C2E2C30-2C5E2C60-2CF32CF9-2D252D272D2D2D30-2D672D6F2D702D7F-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE2DE0-2E3B2E80-2E992E9B-2EF32F00-2FD52FF0-2FFB3000-303F3041-30963099-30FF3105-312D3131-318E3190-31BA31C0-31E331F0-321E3220-32FE3300-4DB54DC0-9FCCA000-A48CA490-A4C6A4D0-A62BA640-A697A69F-A6F7A700-A78EA790-A793A7A0-A7AAA7F8-A82BA830-A839A840-A877A880-A8C4A8CE-A8D9A8E0-A8FBA900-A953A95F-A97CA980-A9CDA9CF-A9D9A9DEA9DFAA00-AA36AA40-AA4DAA50-AA59AA5C-AA7BAA80-AAC2AADB-AAF6AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABEDABF0-ABF9AC00-D7A3D7B0-D7C6D7CB-D7FBD800-FA6DFA70-FAD9FB00-FB06FB13-FB17FB1D-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBC1FBD3-FD3FFD50-FD8FFD92-FDC7FDF0-FDFDFE00-FE19FE20-FE26FE30-FE52FE54-FE66FE68-FE6BFE70-FE74FE76-FEFCFEFFFF01-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDCFFE0-FFE6FFE8-FFEEFFF9-FFFD"
    });

}(XRegExp));


/***** matchrecursive.js *****/

/*!
 * XRegExp.matchRecursive v0.2.0
 * (c) 2009-2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 */

(function (XRegExp) {
    "use strict";

/**
 * Returns a match detail object composed of the provided values.
 * @private
 */
    function row(value, name, start, end) {
        return {value:value, name:name, start:start, end:end};
    }

/**
 * Returns an array of match strings between outermost left and right delimiters, or an array of
 * objects with detailed match parts and position data. An error is thrown if delimiters are
 * unbalanced within the data.
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {String} left Left delimiter as an XRegExp pattern.
 * @param {String} right Right delimiter as an XRegExp pattern.
 * @param {String} [flags] Flags for the left and right delimiters. Use any of: `gimnsxy`.
 * @param {Object} [options] Lets you specify `valueNames` and `escapeChar` options.
 * @returns {Array} Array of matches, or an empty array.
 * @example
 *
 * // Basic usage
 * var str = '(t((e))s)t()(ing)';
 * XRegExp.matchRecursive(str, '\\(', '\\)', 'g');
 * // -> ['t((e))s', '', 'ing']
 *
 * // Extended information mode with valueNames
 * str = 'Here is <div> <div>an</div></div> example';
 * XRegExp.matchRecursive(str, '<div\\s*>', '</div>', 'gi', {
 *   valueNames: ['between', 'left', 'match', 'right']
 * });
 * // -> [
 * // {name: 'between', value: 'Here is ',       start: 0,  end: 8},
 * // {name: 'left',    value: '<div>',          start: 8,  end: 13},
 * // {name: 'match',   value: ' <div>an</div>', start: 13, end: 27},
 * // {name: 'right',   value: '</div>',         start: 27, end: 33},
 * // {name: 'between', value: ' example',       start: 33, end: 41}
 * // ]
 *
 * // Omitting unneeded parts with null valueNames, and using escapeChar
 * str = '...{1}\\{{function(x,y){return y+x;}}';
 * XRegExp.matchRecursive(str, '{', '}', 'g', {
 *   valueNames: ['literal', null, 'value', null],
 *   escapeChar: '\\'
 * });
 * // -> [
 * // {name: 'literal', value: '...', start: 0, end: 3},
 * // {name: 'value',   value: '1',   start: 4, end: 5},
 * // {name: 'literal', value: '\\{', start: 6, end: 8},
 * // {name: 'value',   value: 'function(x,y){return y+x;}', start: 9, end: 35}
 * // ]
 *
 * // Sticky mode via flag y
 * str = '<1><<<2>>><3>4<5>';
 * XRegExp.matchRecursive(str, '<', '>', 'gy');
 * // -> ['1', '<<2>>', '3']
 */
    XRegExp.matchRecursive = function (str, left, right, flags, options) {
        flags = flags || "";
        options = options || {};
        var global = flags.indexOf("g") > -1,
            sticky = flags.indexOf("y") > -1,
            basicFlags = flags.replace(/y/g, ""), // Flag y controlled internally
            escapeChar = options.escapeChar,
            vN = options.valueNames,
            output = [],
            openTokens = 0,
            delimStart = 0,
            delimEnd = 0,
            lastOuterEnd = 0,
            outerStart,
            innerStart,
            leftMatch,
            rightMatch,
            esc;
        left = XRegExp(left, basicFlags);
        right = XRegExp(right, basicFlags);

        if (escapeChar) {
            if (escapeChar.length > 1) {
                throw new SyntaxError("can't use more than one escape character");
            }
            escapeChar = XRegExp.escape(escapeChar);
            // Using XRegExp.union safely rewrites backreferences in `left` and `right`
            esc = new RegExp(
                "(?:" + escapeChar + "[\\S\\s]|(?:(?!" + XRegExp.union([left, right]).source + ")[^" + escapeChar + "])+)+",
                flags.replace(/[^im]+/g, "") // Flags gy not needed here; flags nsx handled by XRegExp
            );
        }

        while (true) {
            // If using an escape character, advance to the delimiter's next starting position,
            // skipping any escaped characters in between
            if (escapeChar) {
                delimEnd += (XRegExp.exec(str, esc, delimEnd, "sticky") || [""])[0].length;
            }
            leftMatch = XRegExp.exec(str, left, delimEnd);
            rightMatch = XRegExp.exec(str, right, delimEnd);
            // Keep the leftmost match only
            if (leftMatch && rightMatch) {
                if (leftMatch.index <= rightMatch.index) {
                    rightMatch = null;
                } else {
                    leftMatch = null;
                }
            }
            /* Paths (LM:leftMatch, RM:rightMatch, OT:openTokens):
            LM | RM | OT | Result
            1  | 0  | 1  | loop
            1  | 0  | 0  | loop
            0  | 1  | 1  | loop
            0  | 1  | 0  | throw
            0  | 0  | 1  | throw
            0  | 0  | 0  | break
            * Doesn't include the sticky mode special case
            * Loop ends after the first completed match if `!global` */
            if (leftMatch || rightMatch) {
                delimStart = (leftMatch || rightMatch).index;
                delimEnd = delimStart + (leftMatch || rightMatch)[0].length;
            } else if (!openTokens) {
                break;
            }
            if (sticky && !openTokens && delimStart > lastOuterEnd) {
                break;
            }
            if (leftMatch) {
                if (!openTokens) {
                    outerStart = delimStart;
                    innerStart = delimEnd;
                }
                ++openTokens;
            } else if (rightMatch && openTokens) {
                if (!--openTokens) {
                    if (vN) {
                        if (vN[0] && outerStart > lastOuterEnd) {
                            output.push(row(vN[0], str.slice(lastOuterEnd, outerStart), lastOuterEnd, outerStart));
                        }
                        if (vN[1]) {
                            output.push(row(vN[1], str.slice(outerStart, innerStart), outerStart, innerStart));
                        }
                        if (vN[2]) {
                            output.push(row(vN[2], str.slice(innerStart, delimStart), innerStart, delimStart));
                        }
                        if (vN[3]) {
                            output.push(row(vN[3], str.slice(delimStart, delimEnd), delimStart, delimEnd));
                        }
                    } else {
                        output.push(str.slice(innerStart, delimStart));
                    }
                    lastOuterEnd = delimEnd;
                    if (!global) {
                        break;
                    }
                }
            } else {
                throw new Error("string contains unbalanced delimiters");
            }
            // If the delimiter matched an empty string, avoid an infinite loop
            if (delimStart === delimEnd) {
                ++delimEnd;
            }
        }

        if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd) {
            output.push(row(vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length));
        }

        return output;
    };

}(XRegExp));


/***** build.js *****/

/*!
 * XRegExp.build v0.1.0
 * (c) 2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 * Inspired by RegExp.create by Lea Verou <http://lea.verou.me/>
 */

(function (XRegExp) {
    "use strict";

    var subparts = /(\()(?!\?)|\\([1-9]\d*)|\\[\s\S]|\[(?:[^\\\]]|\\[\s\S])*]/g,
        parts = XRegExp.union([/\({{([\w$]+)}}\)|{{([\w$]+)}}/, subparts], "g");

/**
 * Strips a leading `^` and trailing unescaped `$`, if both are present.
 * @private
 * @param {String} pattern Pattern to process.
 * @returns {String} Pattern with edge anchors removed.
 */
    function deanchor(pattern) {
        var startAnchor = /^(?:\(\?:\))?\^/, // Leading `^` or `(?:)^` (handles /x cruft)
            endAnchor = /\$(?:\(\?:\))?$/; // Trailing `$` or `$(?:)` (handles /x cruft)
        if (endAnchor.test(pattern.replace(/\\[\s\S]/g, ""))) { // Ensure trailing `$` isn't escaped
            return pattern.replace(startAnchor, "").replace(endAnchor, "");
        }
        return pattern;
    }

/**
 * Converts the provided value to an XRegExp.
 * @private
 * @param {String|RegExp} value Value to convert.
 * @returns {RegExp} XRegExp object with XRegExp syntax applied.
 */
    function asXRegExp(value) {
        return XRegExp.isRegExp(value) ?
                (value.xregexp && !value.xregexp.isNative ? value : XRegExp(value.source)) :
                XRegExp(value);
    }

/**
 * Builds regexes using named subpatterns, for readability and pattern reuse. Backreferences in the
 * outer pattern and provided subpatterns are automatically renumbered to work correctly. Native
 * flags used by provided subpatterns are ignored in favor of the `flags` argument.
 * @memberOf XRegExp
 * @param {String} pattern XRegExp pattern using `{{name}}` for embedded subpatterns. Allows
 *   `({{name}})` as shorthand for `(?<name>{{name}})`. Patterns cannot be embedded within
 *   character classes.
 * @param {Object} subs Lookup object for named subpatterns. Values can be strings or regexes. A
 *   leading `^` and trailing unescaped `$` are stripped from subpatterns, if both are present.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Regex with interpolated subpatterns.
 * @example
 *
 * var time = XRegExp.build('(?x)^ {{hours}} ({{minutes}}) $', {
 *   hours: XRegExp.build('{{h12}} : | {{h24}}', {
 *     h12: /1[0-2]|0?[1-9]/,
 *     h24: /2[0-3]|[01][0-9]/
 *   }, 'x'),
 *   minutes: /^[0-5][0-9]$/
 * });
 * time.test('10:59'); // -> true
 * XRegExp.exec('10:59', time).minutes; // -> '59'
 */
    XRegExp.build = function (pattern, subs, flags) {
        var inlineFlags = /^\(\?([\w$]+)\)/.exec(pattern),
            data = {},
            numCaps = 0, // Caps is short for captures
            numPriorCaps,
            numOuterCaps = 0,
            outerCapsMap = [0],
            outerCapNames,
            sub,
            p;

        // Add flags within a leading mode modifier to the overall pattern's flags
        if (inlineFlags) {
            flags = flags || "";
            inlineFlags[1].replace(/./g, function (flag) {
                flags += (flags.indexOf(flag) > -1 ? "" : flag); // Don't add duplicates
            });
        }

        for (p in subs) {
            if (subs.hasOwnProperty(p)) {
                // Passing to XRegExp enables entended syntax for subpatterns provided as strings
                // and ensures independent validity, lest an unescaped `(`, `)`, `[`, or trailing
                // `\` breaks the `(?:)` wrapper. For subpatterns provided as regexes, it dies on
                // octals and adds the `xregexp` property, for simplicity
                sub = asXRegExp(subs[p]);
                // Deanchoring allows embedding independently useful anchored regexes. If you
                // really need to keep your anchors, double them (i.e., `^^...$$`)
                data[p] = {pattern: deanchor(sub.source), names: sub.xregexp.captureNames || []};
            }
        }

        // Passing to XRegExp dies on octals and ensures the outer pattern is independently valid;
        // helps keep this simple. Named captures will be put back
        pattern = asXRegExp(pattern);
        outerCapNames = pattern.xregexp.captureNames || [];
        pattern = pattern.source.replace(parts, function ($0, $1, $2, $3, $4) {
            var subName = $1 || $2, capName, intro;
            if (subName) { // Named subpattern
                if (!data.hasOwnProperty(subName)) {
                    throw new ReferenceError("undefined property " + $0);
                }
                if ($1) { // Named subpattern was wrapped in a capturing group
                    capName = outerCapNames[numOuterCaps];
                    outerCapsMap[++numOuterCaps] = ++numCaps;
                    // If it's a named group, preserve the name. Otherwise, use the subpattern name
                    // as the capture name
                    intro = "(?<" + (capName || subName) + ">";
                } else {
                    intro = "(?:";
                }
                numPriorCaps = numCaps;
                return intro + data[subName].pattern.replace(subparts, function (match, paren, backref) {
                    if (paren) { // Capturing group
                        capName = data[subName].names[numCaps - numPriorCaps];
                        ++numCaps;
                        if (capName) { // If the current capture has a name, preserve the name
                            return "(?<" + capName + ">";
                        }
                    } else if (backref) { // Backreference
                        return "\\" + (+backref + numPriorCaps); // Rewrite the backreference
                    }
                    return match;
                }) + ")";
            }
            if ($3) { // Capturing group
                capName = outerCapNames[numOuterCaps];
                outerCapsMap[++numOuterCaps] = ++numCaps;
                if (capName) { // If the current capture has a name, preserve the name
                    return "(?<" + capName + ">";
                }
            } else if ($4) { // Backreference
                return "\\" + outerCapsMap[+$4]; // Rewrite the backreference
            }
            return $0;
        });

        return XRegExp(pattern, flags);
    };

}(XRegExp));


/***** prototypes.js *****/

/*!
 * XRegExp Prototype Methods v1.0.0
 * (c) 2012 Steven Levithan <http://xregexp.com/>
 * MIT License
 */

/**
 * Adds a collection of methods to `XRegExp.prototype`. RegExp objects copied by XRegExp are also
 * augmented with any `XRegExp.prototype` methods. Hence, the following work equivalently:
 *
 * XRegExp('[a-z]', 'ig').xexec('abc');
 * XRegExp(/[a-z]/ig).xexec('abc');
 * XRegExp.globalize(/[a-z]/i).xexec('abc');
 */
(function (XRegExp) {
    "use strict";

/**
 * Copy properties of `b` to `a`.
 * @private
 * @param {Object} a Object that will receive new properties.
 * @param {Object} b Object whose properties will be copied.
 */
    function extend(a, b) {
        for (var p in b) {
            if (b.hasOwnProperty(p)) {
                a[p] = b[p];
            }
        }
        //return a;
    }

    extend(XRegExp.prototype, {

/**
 * Implicitly calls the regex's `test` method with the first value in the provided arguments array.
 * @memberOf XRegExp.prototype
 * @param {*} context Ignored. Accepted only for congruity with `Function.prototype.apply`.
 * @param {Array} args Array with the string to search as its first value.
 * @returns {Boolean} Whether the regex matched the provided value.
 * @example
 *
 * XRegExp('[a-z]').apply(null, ['abc']); // -> true
 */
        apply: function (context, args) {
            return this.test(args[0]);
        },

/**
 * Implicitly calls the regex's `test` method with the provided string.
 * @memberOf XRegExp.prototype
 * @param {*} context Ignored. Accepted only for congruity with `Function.prototype.call`.
 * @param {String} str String to search.
 * @returns {Boolean} Whether the regex matched the provided value.
 * @example
 *
 * XRegExp('[a-z]').call(null, 'abc'); // -> true
 */
        call: function (context, str) {
            return this.test(str);
        },

/**
 * Implicitly calls {@link #XRegExp.forEach}.
 * @memberOf XRegExp.prototype
 * @example
 *
 * XRegExp('\\d').forEach('1a2345', function (match, i) {
 *   if (i % 2) this.push(+match[0]);
 * }, []);
 * // -> [2, 4]
 */
        forEach: function (str, callback, context) {
            return XRegExp.forEach(str, this, callback, context);
        },

/**
 * Implicitly calls {@link #XRegExp.globalize}.
 * @memberOf XRegExp.prototype
 * @example
 *
 * var globalCopy = XRegExp('regex').globalize();
 * globalCopy.global; // -> true
 */
        globalize: function () {
            return XRegExp.globalize(this);
        },

/**
 * Implicitly calls {@link #XRegExp.exec}.
 * @memberOf XRegExp.prototype
 * @example
 *
 * var match = XRegExp('U\\+(?<hex>[0-9A-F]{4})').xexec('U+2620');
 * match.hex; // -> '2620'
 */
        xexec: function (str, pos, sticky) {
            return XRegExp.exec(str, this, pos, sticky);
        },

/**
 * Implicitly calls {@link #XRegExp.test}.
 * @memberOf XRegExp.prototype
 * @example
 *
 * XRegExp('c').xtest('abc'); // -> true
 */
        xtest: function (str, pos, sticky) {
            return XRegExp.test(str, this, pos, sticky);
        }

    });

}(XRegExp));


},{}],2:[function(require,module,exports){
/**
 * Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
 * with HTTP request/response bodies.
 * @module http
 */

var _i = siesta._internal,
    log = _i.log,
    InternalSiestaError = _i.error.InternalSiestaError,
    assert = _i.misc.assert,
    defineSubProperty = _i.misc.defineSubProperty,
    CollectionRegistry = _i.CollectionRegistry,
    extend = _i.extend,
    util = _i.util,
    _ = util._;

var Logger = log.loggerWithName('Descriptor');
Logger.setLevel(log.Level.warn);
// The XRegExp object has these properties that we want to ignore when matching.
var ignore = ['index', 'input'];
var XRegExp = require('xregexp').XRegExp;

var httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

function resolveMethod(methods) {
        // Convert wildcards into methods and ensure is an array of uppercase methods.
    if (methods) {
        if (methods == '*' || methods.indexOf('*') > -1) {
            methods = httpMethods;
        } else if (!util.isArray(methods)) {
            methods = [methods];
        }
    } else {
        methods = ['GET'];
    }
    return _.map(methods, function(x) {
        return x.toUpperCase()
    });
}

/**
 * A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
 * intercept a HTTP request/response and perform a mapping.
 *
 * @constructor
 * @param {Object} opts
 */
function Descriptor(opts) {
    if (!this) {
        return new Descriptor(opts);
    }

    this._rawOpts = extend(true, {}, opts);
    this._opts = opts;

    // Convert path string into XRegExp if not already.
    if (this._opts.path) {
        if (!(this._opts.path instanceof XRegExp)) {
            this._opts.path = XRegExp(this._opts.path);
        }
    } else {
        this._opts.path = '';
    }

    this._opts.method = resolveMethod(this._opts.method);

    // Mappings can be passed as the actual mapping object or as a string (with API specified too)
    if (this._opts.mapping) {
        if (typeof(this._opts.mapping) == 'string') {
            if (this._opts.collection) {
                var collection;
                if (typeof(this._opts.collection) == 'string') {
                    collection = CollectionRegistry[this._opts.collection];
                } else {
                    collection = this._opts.collection;
                }
                if (collection) {
                    var actualMapping = collection[this._opts.mapping];
                    if (actualMapping) {
                        this._opts.mapping = actualMapping;
                    } else {
                        throw new InternalSiestaError('Mapping ' + this._opts.mapping + ' does not exist', {
                            opts: opts,
                            descriptor: this
                        });
                    }
                } else {
                    throw new InternalSiestaError('Collection ' + this._opts.collection + ' does not exist', {
                        opts: opts,
                        descriptor: this
                    });
                }
            } else {
                throw new InternalSiestaError('Passed mapping as string, but did not specify the collection it belongs to', {
                    opts: opts,
                    descriptor: this
                });
            }
        }
    } else {
        throw new InternalSiestaError('Descriptors must be initialised with a mapping', {
            opts: opts,
            descriptor: this
        });
    }

    // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
    // otherwise leave as string or undefined.
    var data = this._opts.data;
    if (data) {
        if (data.length) {
            var root;
            var arr = data.split('.');
            if (arr.length == 1) {
                root = arr[0];
            } else {
                var obj = {};
                root = obj;
                var previousKey = arr[0];
                for (var i = 1; i < arr.length; i++) {
                    var key = arr[i];
                    if (i == (arr.length - 1)) {
                        obj[previousKey] = key;
                    } else {
                        var newVar = {};
                        obj[previousKey] = newVar;
                        obj = newVar;
                        previousKey = key;
                    }
                }
            }
            this._opts.data = root;
        }
    }

    /**
     * @name path
     * @type {String}
     */
    defineSubProperty.call(this, 'path', this._opts);
    defineSubProperty.call(this, 'method', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'transforms', this._opts);
}

Descriptor.prototype.httpMethods = httpMethods;

/**
 * Takes a regex path and returns an object if matched.
 * If any regular expression groups were defined, the returned object will contain the matches.
 *
 * @param  {String|RegExp} path
 * @return {Object}
 * @internal
 * @example
 * ```js
 * var d = new Descriptor({
 *     path: '/resource/(?P<id>)/'
 * })
 * var matched = d._matchPath('/resource/2');
 * console.log(matched); // {id: '2'}
 * ```
 */
Descriptor.prototype._matchPath = function(path) {
    var match = XRegExp.exec(path, this.path);
    var matched = null;
    if (match) {
        matched = {};
        for (var prop in match) {
            if (match.hasOwnProperty(prop)) {
                if (isNaN(parseInt(prop)) && ignore.indexOf(prop) < 0) {
                    matched[prop] = match[prop];
                }
            }
        }
    }
    return matched;
};

/**
 * Returns true if the descriptor accepts the HTTP method.
 *
 * @param  {String} method
 * @return {boolean}
 * @internal
 * @example
 * ```js
 * var d = new Descriptor({
 *     method: ['POST', 'PUT']
 * });
 * console.log(d._matchMethod('GET')); // false
 * ```
 */
Descriptor.prototype._matchMethod = function(method) {
    for (var i = 0; i < this.method.length; i++) {
        if (method.toUpperCase() == this.method[i]) {
            return true;
        }
    }
    return false;
};

/**
 * Performs a breadth-first search through data, embedding obj in the first leaf.
 *
 * @param  {Object} obj
 * @param  {Object} data
 * @return {Object}
 */
function bury(obj, data) {
    var root = data;
    var keys = Object.keys(data);
    assert(keys.length == 1);
    var key = keys[0];
    var curr = data;
    while (!(typeof(curr[key]) == 'string')) {
        curr = curr[key];
        keys = Object.keys(curr);
        assert(keys.length == 1);
        key = keys[0];
    }
    var newParent = curr[key];
    var newObj = {};
    curr[key] = newObj;
    newObj[newParent] = obj;
    return root;
}

Descriptor.prototype._embedData = function(data) {
    if (this.data) {
        var nested;
        if (typeof(this.data) == 'string') {
            nested = {};
            nested[this.data] = data;
        } else {
            nested = bury(data, extend(true, {}, this.data));
        }
        return nested;
    } else {
        return data;
    }
};

/**
 * If nested data has been specified in the descriptor, extract the data.
 * @param  {Object} data
 * @return {Object}
 */
Descriptor.prototype._extractData = function(data) {
    if (Logger.debug.isEnabled)
        Logger.debug('_extractData', data);
    if (this.data) {
        if (typeof(this.data) == 'string') {
            return data[this.data];
        } else {
            var keys = Object.keys(this.data);
            assert(keys.length == 1);
            var currTheirs = data;
            var currOurs = this.data;
            while (typeof(currOurs) != 'string') {
                keys = Object.keys(currOurs);
                assert(keys.length == 1);
                var key = keys[0];
                currOurs = currOurs[key];
                currTheirs = currTheirs[key];
                if (!currTheirs) {
                    break;
                }
            }
            return currTheirs ? currTheirs[currOurs] : null;
        }
    } else {
        return data;
    }
};

/**
 * Returns this descriptors mapping if the request config matches.
 * @param {Object} config
 * @returns {Object}
 */
Descriptor.prototype._matchConfig = function(config) {
    var matches = config.type ? this._matchMethod(config.type) : {};
    if (matches) {
        matches = config.url ? this._matchPath(config.url) : {};
    }
    if (matches) {
        if (Logger.trace.isEnabled)
            Logger.trace('matched config');
    }
    return matches;
};

/**
 * Returns data if the data matches, performing any extraction as specified in opts.data
 *
 * @param  {Object} data
 * @return {Object}
 */
Descriptor.prototype._matchData = function(data) {
    var extractedData = null;
    if (this.data) {
        if (data) {
            extractedData = this._extractData(data);
        }
    } else {
        extractedData = data;
    }
    if (extractedData) {
        Logger.trace('matched data');
    }
    return extractedData;
};

/**
 * Check if the HTTP config and returned data match this descriptor definition.
 *
 * @param  {Object} config Config object for $.ajax and similar
 * @param  {Object} data
 * @return {Object} Extracted data
 */
Descriptor.prototype.match = function(config, data) {
    var regexMatches = this._matchConfig(config);
    var matches = !!regexMatches;
    var extractedData = false;
    if (matches) {
        Logger.trace('config matches');
        extractedData = this._matchData(data);
        matches = !!extractedData;
        if (matches) {
            var key;
            if (util.isArray(extractedData)) {
                for (key in regexMatches) {
                    if (regexMatches.hasOwnProperty(key)) {
                        _.each(extractedData, function(datum) {
                            datum[key] = regexMatches[key];
                        });
                    }
                }
            } else {
                for (key in regexMatches) {
                    if (regexMatches.hasOwnProperty(key)) {
                        extractedData[key] = regexMatches[key];
                    }
                }
            }
            Logger.trace('data matches');
        } else {
            Logger.trace('data doesnt match');
        }
    } else {
        Logger.trace('config doesnt match');
    }
    return extractedData;
};

/**
 * Apply any transforms.
 * @param  {Object} data Serialised data.
 * @return {Object} Serialised data with applied transformations.
 */
Descriptor.prototype._transformData = function(data) {
    var transforms = this.transforms;
    if (typeof(transforms) == 'function') {
        data = transforms(data);
    } else {
        for (var attr in transforms) {
            if (transforms.hasOwnProperty(attr)) {
                if (data[attr]) {
                    var transform = transforms[attr];
                    var val = data[attr];
                    if (typeof(transform) == 'string') {
                        var split = transform.split('.');
                        delete data[attr];
                        if (split.length == 1) {
                            data[split[0]] = val;
                        } else {
                            data[split[0]] = {};
                            var newVal = data[split[0]];
                            for (var i = 1; i < split.length - 1; i++) {
                                var newAttr = split[i];
                                newVal[newAttr] = {};
                                newVal = newVal[newAttr];
                            }
                            newVal[split[split.length - 1]] = val;
                        }
                    } else if (typeof(transform) == 'function') {
                        var transformed = transform(val);
                        if (util.isArray(transformed)) {
                            delete data[attr];
                            data[transformed[0]] = transformed[1];
                        } else {
                            data[attr] = transformed;
                        }
                    } else {
                        throw new InternalSiestaError('Invalid transformer');
                    }
                }
            }
        }
    }
    return data;
};


exports.Descriptor = Descriptor;
exports.resolveMethod = resolveMethod;
},{"xregexp":1}],3:[function(require,module,exports){
var _i = siesta._internal;
var log = _i.log;
var Logger = log.loggerWithName('DescriptorRegistry');
Logger.setLevel(log.Level.warn);

var assert = _i.misc.assert;

/**
 * @class Entry point for descriptor registration.
 * @constructor
 */
function DescriptorRegistry() {
    if (!this) {
        return new DescriptorRegistry(opts);
    }
    this.requestDescriptors = {};
    this.responseDescriptors = {};
}

function _registerDescriptor(descriptors, descriptor) {
    var mapping = descriptor.mapping;
    var collection = mapping.collection;
    assert(mapping);
    assert(collection);
    assert(typeof(collection) == 'string');
    if (!descriptors[collection]) {
        descriptors[collection] = [];
    }
    descriptors[collection].push(descriptor);
}

DescriptorRegistry.prototype.registerRequestDescriptor = function (requestDescriptor) {
    _registerDescriptor(this.requestDescriptors, requestDescriptor);
};

DescriptorRegistry.prototype.registerResponseDescriptor = function (responseDescriptor) {
    if (Logger.trace.isEnabled)
        Logger.trace('registerResponseDescriptor');
    _registerDescriptor(this.responseDescriptors, responseDescriptor);
};

function _descriptorsForCollection(descriptors, collection) {
    var descriptorsForCollection;
    if (typeof(collection) == 'string') {
        descriptorsForCollection = descriptors[collection] || [];
    }
    else {
        descriptorsForCollection = (descriptors[collection._name] || []);
    }
    return descriptorsForCollection;
}

DescriptorRegistry.prototype.requestDescriptorsForCollection = function (collection) {
    return _descriptorsForCollection(this.requestDescriptors, collection);
};

DescriptorRegistry.prototype.responseDescriptorsForCollection = function (collection) {
    var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
    if (!descriptorsForCollection.length) {
        if (Logger.debug.isEnabled)
            Logger.debug('No response descriptors for collection ', this.responseDescriptors);
    }
    return  descriptorsForCollection;
};

DescriptorRegistry.prototype.reset = function () {
    this.requestDescriptors = {};
    this.responseDescriptors = {};
};

exports.DescriptorRegistry = new DescriptorRegistry();
},{}],4:[function(require,module,exports){
/**
 * Provisions usage of $.ajax and similar functions to send HTTP requests mapping
 * the results back onto the object graph automatically.
 * @module http
 */

if (!siesta) {
    throw new Error('Could not find siesta');
}

var _i = siesta._internal,
    Collection = siesta.Collection,
    log = _i.log,
    util = _i.util,
    descriptor = require('./descriptor'),
    InternalSiestaError = _i.error.InternalSiestaError,
    q = _i.q;

var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;

var Logger = log.loggerWithName('HTTP');
Logger.setLevel(log.Level.warn);

/**
 * Send a HTTP request to the given method and path parsing the response.
 * @param {String} method
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 */
function _httpResponse(method, path) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 2);
    var callback;
    var opts = {};
    var name = this._name;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    opts.type = method;
    if (!opts.url) { // Allow overrides.
        var baseURL = this.baseURL;
        opts.url = baseURL + path;
    }
    if (opts.parseResponse === undefined) opts.parseResponse = true;
    opts.success = function(data, textStatus, jqXHR) {
        if (Logger.trace.isEnabled)
            Logger.trace(opts.type + ' ' + jqXHR.status + ' ' + opts.url + ': ' + JSON.stringify(data, null, 4));
        var resp = {
            data: data,
            status: textStatus,
            xhr: jqXHR
        };
        if (opts.parseResponse) {
            var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
            var matchedDescriptor;
            var extractedData;

            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
                console.log('descriptor', descriptor);
                extractedData = descriptor.match(opts, data);
                if (extractedData) {
                    matchedDescriptor = descriptor;
                    break;
                }
            }

            if (matchedDescriptor) {
                if (Logger.trace.isEnabled)
                    Logger.trace('Mapping extracted data: ' + JSON.stringify(extractedData, null, 4));
                if (typeof(extractedData) == 'object') {
                    var mapping = matchedDescriptor.mapping;
                    mapping.map(extractedData, function(err, obj) {
                        if (callback) {

                            callback(err, obj, resp);
                        }
                    }, opts.obj);
                } else { // Matched, but no data.
                    callback(null, true, resp);
                }
            } else if (callback) {
                if (name) {
                    callback(null, null, resp);
                } else {
                    // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                    throw new InternalSiestaError('Unnamed collection');
                }
            }
        } else {
            callback(null, null, resp);
        }

    };
    opts.error = function(jqXHR, textStatus, errorThrown) {
        var resp = {
            xhr: jqXHR,
            status: textStatus,
            errorThrown: errorThrown
        };
        if (callback) callback(resp, null, resp);
    };
    if (Logger.trace.isEnabled)
        Logger.trace('Ajax request:', opts);
    $.ajax(opts);
};

function _serialiseObject(opts, obj, cb) {
    this._serialise(obj, function (err, data) {
        var retData = data;
        if (opts.fields) {
            retData = {};
            _.each(opts.fields, function (f) {
                retData[f] = data[f];
            });
        }
        cb(err, retData);
    });
}

/**
 * Send a HTTP request to the given method and path
 * @param {String} method
 * @param {String} path The path to the resource we want to GET
 * @param {SiestaModel} object The model we're pushing to the server
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 */
function _httpRequest(method, path, object) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 3);
    var callback;
    var opts = {};
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    args = Array.prototype.slice.call(args, 2);
    var requestDescriptors = DescriptorRegistry.requestDescriptorsForCollection(this);
    var matchedDescriptor;
    opts.type = method;
    var baseURL = this.baseURL;
    opts.url = baseURL + path;
    for (var i = 0; i < requestDescriptors.length; i++) {
        var requestDescriptor = requestDescriptors[i];
        if (requestDescriptor._matchConfig(opts)) {
            matchedDescriptor = requestDescriptor;
            break;
        }
    }
    if (matchedDescriptor) {
        if (Logger.trace.isEnabled)
            Logger.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
        _serialiseObject.call(matchedDescriptor, object, opts, function (err, data) {
            if (Logger.trace.isEnabled)
                Logger.trace('_serialise', {
                    err: err,
                    data: data
                });
            if (err) {
                if (callback) callback(err, null, null);
            } else {
                opts.data = data;
                opts.obj = object;
                _.partial(_httpResponse, method, path, opts, callback).apply(self, args);
            }
        });
       
    } else if (callback) {
        if (Logger.trace.isEnabled)
            Logger.trace('Did not match descriptor');
        callback(null, null, null);
    }
    return deferred.promise;
};

/**
 * Send a DELETE request. Also removes the object.
 * @param {Collection} collection
 * @param {Stirng} path The path to the resource to which we want to DELETE
 * @param {SiestaModel} model The model that we would like to PATCH
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
function DELETE(collection, path, object) {
    var deferred = q.defer();
    var args = Array.prototype.slice.call(arguments, 3);
    var opts = {};
    var callback;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var deletionMode = opts.deletionMode || 'restore';
    // By default we do not map the response from a DELETE request.
    if (opts.parseResponse === undefined) opts.parseResponse = false;
    _httpResponse.call(collection, 'DELETE', path, opts, function(err, x, y, z) {
        if (err) {
            if (deletionMode == 'restore') {
                object.restore();
            }
        } else if (deletionMode == 'success') {
            object.remove();
        }
        callback(err, x, y, z);
    });
    if (deletionMode == 'now' || deletionMode == 'restore') {
        object.remove();
    }
    return deferred.promise;
}

/**
 * Send a HTTP request using the given method
 * @param {Collection} collection
 * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
 * @param method
 * @internal
 * @returns {Promise}
 */
function HTTP_METHOD(collection, request, method) {
    var args = Array.prototype.slice.call(arguments, 3);
    return _.partial(request ? _httpRequest : _httpResponse, method).apply(collection, args);
}

/**
 * Send a GET request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function GET(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, false, 'GET').apply(this, args);
}

/**
 * Send an OPTIONS request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function OPTIONS(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, false, 'OPTIONS').apply(this, args);
}

/**
 * Send an TRACE request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function TRACE(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, false, 'TRACE').apply(this, args);
}

/**
 * Send an HEAD request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function HEAD(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, false, 'HEAD').apply(this, args);
}

/**
 * Send an POST request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {SiestaModel} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function POST(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, true, 'POST').apply(this, args);
}

/**
 * Send an PUT request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {SiestaModel} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PUT(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, true, 'PUT').apply(this, args);
}

/**
 * Send an PATCH request
 * @param {Collection} collection
 * @param {String} path The path to the resource we want to GET
 * @param {SiestaModel} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PATCH(collection) {
    var args = Array.prototype.slice.call(arguments, 1);
    return _.partial(HTTP_METHOD, collection, true, 'PATCH').apply(this, args);
}

var ajax;

if (!siesta.ext) {
    siesta.ext = {};
}



siesta.ext.http = {
    RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
    ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
    Descriptor: descriptor.Descriptor,
    _resolveMethod: descriptor.resolveMethod,
    Serialiser: require('./serialiser'),
    DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry,
    setAjax: function(_ajax) {
        ajax = _ajax;
    },
    _httpResponse: _httpResponse,
    _httpRequest: _httpRequest,
    DELETE: DELETE,
    HTTP_METHOD: HTTP_METHOD,
    GET: GET,
    TRACE: TRACE,
    OPTIONS: OPTIONS,
    HEAD: HEAD,
    POST: POST,
    PUT: PUT,
    PATCH: PATCH,
    _serialiseObject: _serialiseObject
};

Object.defineProperty(siesta.ext.http, 'ajax', {
    get: function() {
        var a = ajax || ($ ? $.ajax : null) || (jQuery ? jQuery.ajax : null);
        if (!a) {
            throw new InternalSiestaError('ajax has not been defined and could not find $.ajax or jQuery.ajax');
        }
        return a;
    },
    set: function(v) {
        ajax = v;
    }
});
},{"./descriptor":2,"./descriptorRegistry":3,"./requestDescriptor":5,"./responseDescriptor":6,"./serialiser":7}],5:[function(require,module,exports){
/**
 * @module http
 */

var Descriptor = require('./descriptor').Descriptor
    , Serialiser = require('./serialiser');

var _i = siesta._internal
    , q = _i.q
    , util = _i.util
    , log = _i.log
    , defineSubProperty = _i.misc.defineSubProperty
;

var Logger = log.loggerWithName('RequestDescriptor');
Logger.setLevel(log.Level.warn);

/**
 * @class Describes a HTTP request
 * @param {Object} opts
 */
function RequestDescriptor(opts) {
    if (!this) {
        return new RequestDescriptor(opts);
    }

    Descriptor.call(this, opts);
    if (this._opts['serializer']) {
        this._opts.serialiser = this._opts['serializer'];
    }

    if (!this._opts.serialiser) {
        this._opts.serialiser = Serialiser.depthSerializer(0);
    }


    defineSubProperty.call(this, 'serialiser', this._opts);
    defineSubProperty.call(this, 'serializer', this._opts, 'serialiser');

}

RequestDescriptor.prototype = Object.create(Descriptor.prototype);


RequestDescriptor.prototype._serialise = function (obj, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (Logger.trace.isEnabled)
        Logger.trace('_serialise');
    var finished;
    var data = this.serialiser(obj, function (err, data) {
        if (!finished) {
            data = self._transformData(data);
            if (callback) callback(err, self._embedData(data));
        }
    });
    if (data !== undefined) {
        if (Logger.trace.isEnabled)
            Logger.trace('serialiser doesnt use a callback');
        finished = true;
        data = self._transformData(data);
        if (callback) callback(null, self._embedData(data));
    }
    else {
        if (Logger.trace.isEnabled)
            Logger.trace('serialiser uses a callback', this.serialiser);
    }
    return deferred.promise;
};

RequestDescriptor.prototype._dump = function (asJson) {
    var obj = {};
    obj.methods = this.method;
    obj.mapping = this.mapping.type;
    obj.path = this._rawOpts.path;
    var serialiser;
    if (typeof(this._rawOpts.serialiser) == 'function') {
        serialiser = 'function () { ... }'
    }
    else {
        serialiser = this._rawOpts.serialiser;
    }
    obj.serialiser = serialiser;
    var transforms = {};
    for (var f in this.transforms) {
        if (this.transforms.hasOwnProperty(f)) {
            var transform = this.transforms[f];
            if (typeof(transform) == 'function') {
                transforms[f] = 'function () { ... }'
            }
            else {
                transforms[f] = this.transforms[f];
            }
        }
    }
    obj.transforms = transforms;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.RequestDescriptor = RequestDescriptor;

},{"./descriptor":2,"./serialiser":7}],6:[function(require,module,exports){
/**
 * @module http
 */


var Descriptor = require('./descriptor').Descriptor;

/**
 * Describes what to do with a HTTP response.
 * @constructor
 * @implements {Descriptor}
 * @param {Object} opts
 */
function ResponseDescriptor(opts) {
    if (!this) {
        return new ResponseDescriptor(opts);
    }
    Descriptor.call(this, opts);
}

ResponseDescriptor.prototype = Object.create(Descriptor.prototype);

ResponseDescriptor.prototype._extractData = function (data) {
    var extractedData = Descriptor.prototype._extractData.call(this, data);
    if (extractedData) {
        extractedData = this._transformData(extractedData);
    }
    return extractedData;
};

ResponseDescriptor.prototype._matchData = function (data) {
    var extractedData = Descriptor.prototype._matchData.call(this, data);
    if (extractedData) {
        extractedData = this._transformData(extractedData);
    }
    return extractedData;
};

ResponseDescriptor.prototype._dump = function (asJson) {
    var obj = {};
    obj.methods = this.method;
    obj.mapping = this.mapping.type;
    obj.path = this._rawOpts.path;
    var transforms = {};
    for (var f in this.transforms) {
        if (this.transforms.hasOwnProperty(f)) {
            var transform = this.transforms[f];
            if (typeof(transform) == 'function') {
                transforms[f] = 'function () { ... }'
            }
            else {
                transforms[f] = this.transforms[f];
            }
        }
    }
    obj.transforms = transforms;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.ResponseDescriptor = ResponseDescriptor;
},{"./descriptor":2}],7:[function(require,module,exports){
/**
 * @module http
 */

var _i = siesta._internal;

var log = _i.log
    , utils = _i.util;
var Logger = log.loggerWithName('Serialiser');
Logger.setLevel(log.Level.warn);
var _ = utils._;

/**
 * Serialises an object into it's remote identifier (as defined by the mapping)
 * @param  {SiestaModel} obj
 * @return {String}
 * 
 */
function idSerialiser(obj) {
    var idField = obj.mapping.id;
    if (idField) {
        return obj[idField] ? obj[idField] : null;
    }
    else {
        if (Logger.debug.isEnabled)
            Logger.debug('No idfield');
        return undefined;
    }
}

/**
 * Serialises obj following relationships to specified depth.
 * @param  {Integer}   depth
 * @param  {SiestaModel}   obj
 * @param  {Function} done 
 */
function depthSerialiser(depth, obj, done) {
    if (Logger.trace.isEnabled)
        Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._fields, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('field', f);
        if (obj[f]) {
            data[f] = obj[f];
        }
    });
    var waiting = [];
    var errors = [];
    var result = {};
    var finished = [];
    _.each(obj._relationshipFields, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('relationshipField', f);
        var proxy = obj[f + 'Proxy'];
        if (proxy.isForward) { // By default only forward relationship.
            if (Logger.debug.isEnabled)
                Logger.debug(f);
            waiting.push(f);
            proxy.get(function (err, v) {
                if (Logger.trace.isEnabled)
                    Logger.trace('proxy.get', f);
                if (Logger.debug.isEnabled)
                    Logger.debug(f, v);
                if (err) {
                    errors.push(err);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                }
                else if (v) {
                    if (!depth) {
                        finished.push(f);
                        data[f] = v[obj[f + 'Proxy'].forwardMapping.id];
                        result[f] = {err: err, v: v};
                        if ((waiting.length == finished.length) && done) {
                            done(errors.length ? errors : null, data, result);
                        }
                    }
                    else {
                        depthSerialiser(depth - 1, v, function (err, subData, resp) {
                            if (err) {
                                errors.push(err);
                            }
                            else {
                                data[f] = subData;
                            }
                            finished.push(f);
                            result[f] = {err: err, v: v, resp: resp};
                            if ((waiting.length == finished.length) && done) {
                                done(errors.length ? errors : null, data, result);
                            }
                        });
                    }
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('no value for ' + f);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                    if ((waiting.length == finished.length) && done) {
                        done(errors.length ? errors : null, data, result);
                    }
                }
            });
        }
    });
    if (!waiting.length) {
        if (done) done(null, data, {});
    }
}


exports.depthSerialiser = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;


},{}]},{},[4])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMveHJlZ2V4cC94cmVnZXhwLWFsbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9kZXNjcmlwdG9yUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9odHRwLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9yZXNwb25zZURlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9zZXJpYWxpc2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwd0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2WkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9YQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbi8qKioqKiB4cmVnZXhwLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCB2Mi4wLjBcclxuICogKGMpIDIwMDctMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFhSZWdFeHAgcHJvdmlkZXMgYXVnbWVudGVkLCBleHRlbnNpYmxlIEphdmFTY3JpcHQgcmVndWxhciBleHByZXNzaW9ucy4gWW91IGdldCBuZXcgc3ludGF4LFxyXG4gKiBmbGFncywgYW5kIG1ldGhvZHMgYmV5b25kIHdoYXQgYnJvd3NlcnMgc3VwcG9ydCBuYXRpdmVseS4gWFJlZ0V4cCBpcyBhbHNvIGEgcmVnZXggdXRpbGl0eSBiZWx0XHJcbiAqIHdpdGggdG9vbHMgdG8gbWFrZSB5b3VyIGNsaWVudC1zaWRlIGdyZXBwaW5nIHNpbXBsZXIgYW5kIG1vcmUgcG93ZXJmdWwsIHdoaWxlIGZyZWVpbmcgeW91IGZyb21cclxuICogd29ycnlpbmcgYWJvdXQgcGVza3kgY3Jvc3MtYnJvd3NlciBpbmNvbnNpc3RlbmNpZXMgYW5kIHRoZSBkdWJpb3VzIGBsYXN0SW5kZXhgIHByb3BlcnR5LiBTZWVcclxuICogWFJlZ0V4cCdzIGRvY3VtZW50YXRpb24gKGh0dHA6Ly94cmVnZXhwLmNvbS8pIGZvciBtb3JlIGRldGFpbHMuXHJcbiAqIEBtb2R1bGUgeHJlZ2V4cFxyXG4gKiBAcmVxdWlyZXMgTi9BXHJcbiAqL1xyXG52YXIgWFJlZ0V4cDtcclxuXHJcbi8vIEF2b2lkIHJ1bm5pbmcgdHdpY2U7IHRoYXQgd291bGQgcmVzZXQgdG9rZW5zIGFuZCBjb3VsZCBicmVhayByZWZlcmVuY2VzIHRvIG5hdGl2ZSBnbG9iYWxzXHJcblhSZWdFeHAgPSBYUmVnRXhwIHx8IChmdW5jdGlvbiAodW5kZWYpIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgUHJpdmF0ZSB2YXJpYWJsZXNcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIHZhciBzZWxmLFxyXG4gICAgICAgIGFkZFRva2VuLFxyXG4gICAgICAgIGFkZCxcclxuXHJcbi8vIE9wdGlvbmFsIGZlYXR1cmVzOyBjYW4gYmUgaW5zdGFsbGVkIGFuZCB1bmluc3RhbGxlZFxyXG4gICAgICAgIGZlYXR1cmVzID0ge1xyXG4gICAgICAgICAgICBuYXRpdmVzOiBmYWxzZSxcclxuICAgICAgICAgICAgZXh0ZW5zaWJpbGl0eTogZmFsc2VcclxuICAgICAgICB9LFxyXG5cclxuLy8gU3RvcmUgbmF0aXZlIG1ldGhvZHMgdG8gdXNlIGFuZCByZXN0b3JlIChcIm5hdGl2ZVwiIGlzIGFuIEVTMyByZXNlcnZlZCBrZXl3b3JkKVxyXG4gICAgICAgIG5hdGl2ID0ge1xyXG4gICAgICAgICAgICBleGVjOiBSZWdFeHAucHJvdG90eXBlLmV4ZWMsXHJcbiAgICAgICAgICAgIHRlc3Q6IFJlZ0V4cC5wcm90b3R5cGUudGVzdCxcclxuICAgICAgICAgICAgbWF0Y2g6IFN0cmluZy5wcm90b3R5cGUubWF0Y2gsXHJcbiAgICAgICAgICAgIHJlcGxhY2U6IFN0cmluZy5wcm90b3R5cGUucmVwbGFjZSxcclxuICAgICAgICAgICAgc3BsaXQ6IFN0cmluZy5wcm90b3R5cGUuc3BsaXRcclxuICAgICAgICB9LFxyXG5cclxuLy8gU3RvcmFnZSBmb3IgZml4ZWQvZXh0ZW5kZWQgbmF0aXZlIG1ldGhvZHNcclxuICAgICAgICBmaXhlZCA9IHt9LFxyXG5cclxuLy8gU3RvcmFnZSBmb3IgY2FjaGVkIHJlZ2V4ZXNcclxuICAgICAgICBjYWNoZSA9IHt9LFxyXG5cclxuLy8gU3RvcmFnZSBmb3IgYWRkb24gdG9rZW5zXHJcbiAgICAgICAgdG9rZW5zID0gW10sXHJcblxyXG4vLyBUb2tlbiBzY29wZXNcclxuICAgICAgICBkZWZhdWx0U2NvcGUgPSBcImRlZmF1bHRcIixcclxuICAgICAgICBjbGFzc1Njb3BlID0gXCJjbGFzc1wiLFxyXG5cclxuLy8gUmVnZXhlcyB0aGF0IG1hdGNoIG5hdGl2ZSByZWdleCBzeW50YXhcclxuICAgICAgICBuYXRpdmVUb2tlbnMgPSB7XHJcbiAgICAgICAgICAgIC8vIEFueSBuYXRpdmUgbXVsdGljaGFyYWN0ZXIgdG9rZW4gaW4gZGVmYXVsdCBzY29wZSAoaW5jbHVkZXMgb2N0YWxzLCBleGNsdWRlcyBjaGFyYWN0ZXIgY2xhc3NlcylcclxuICAgICAgICAgICAgXCJkZWZhdWx0XCI6IC9eKD86XFxcXCg/OjAoPzpbMC0zXVswLTddezAsMn18WzQtN11bMC03XT8pP3xbMS05XVxcZCp8eFtcXGRBLUZhLWZdezJ9fHVbXFxkQS1GYS1mXXs0fXxjW0EtWmEtel18W1xcc1xcU10pfFxcKFxcP1s6PSFdfFs/KitdXFw/fHtcXGQrKD86LFxcZCopP31cXD8/KS8sXHJcbiAgICAgICAgICAgIC8vIEFueSBuYXRpdmUgbXVsdGljaGFyYWN0ZXIgdG9rZW4gaW4gY2hhcmFjdGVyIGNsYXNzIHNjb3BlIChpbmNsdWRlcyBvY3RhbHMpXHJcbiAgICAgICAgICAgIFwiY2xhc3NcIjogL14oPzpcXFxcKD86WzAtM11bMC03XXswLDJ9fFs0LTddWzAtN10/fHhbXFxkQS1GYS1mXXsyfXx1W1xcZEEtRmEtZl17NH18Y1tBLVphLXpdfFtcXHNcXFNdKSkvXHJcbiAgICAgICAgfSxcclxuXHJcbi8vIEFueSBiYWNrcmVmZXJlbmNlIGluIHJlcGxhY2VtZW50IHN0cmluZ3NcclxuICAgICAgICByZXBsYWNlbWVudFRva2VuID0gL1xcJCg/OnsoW1xcdyRdKyl9fChcXGRcXGQ/fFtcXHNcXFNdKSkvZyxcclxuXHJcbi8vIEFueSBjaGFyYWN0ZXIgd2l0aCBhIGxhdGVyIGluc3RhbmNlIGluIHRoZSBzdHJpbmdcclxuICAgICAgICBkdXBsaWNhdGVGbGFncyA9IC8oW1xcc1xcU10pKD89W1xcc1xcU10qXFwxKS9nLFxyXG5cclxuLy8gQW55IGdyZWVkeS9sYXp5IHF1YW50aWZpZXJcclxuICAgICAgICBxdWFudGlmaWVyID0gL14oPzpbPyorXXx7XFxkKyg/OixcXGQqKT99KVxcPz8vLFxyXG5cclxuLy8gQ2hlY2sgZm9yIGNvcnJlY3QgYGV4ZWNgIGhhbmRsaW5nIG9mIG5vbnBhcnRpY2lwYXRpbmcgY2FwdHVyaW5nIGdyb3Vwc1xyXG4gICAgICAgIGNvbXBsaWFudEV4ZWNOcGNnID0gbmF0aXYuZXhlYy5jYWxsKC8oKT8/LywgXCJcIilbMV0gPT09IHVuZGVmLFxyXG5cclxuLy8gQ2hlY2sgZm9yIGZsYWcgeSBzdXBwb3J0IChGaXJlZm94IDMrKVxyXG4gICAgICAgIGhhc05hdGl2ZVkgPSBSZWdFeHAucHJvdG90eXBlLnN0aWNreSAhPT0gdW5kZWYsXHJcblxyXG4vLyBVc2VkIHRvIGtpbGwgaW5maW5pdGUgcmVjdXJzaW9uIGR1cmluZyBYUmVnRXhwIGNvbnN0cnVjdGlvblxyXG4gICAgICAgIGlzSW5zaWRlQ29uc3RydWN0b3IgPSBmYWxzZSxcclxuXHJcbi8vIFN0b3JhZ2UgZm9yIGtub3duIGZsYWdzLCBpbmNsdWRpbmcgYWRkb24gZmxhZ3NcclxuICAgICAgICByZWdpc3RlcmVkRmxhZ3MgPSBcImdpbVwiICsgKGhhc05hdGl2ZVkgPyBcInlcIiA6IFwiXCIpO1xyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgUHJpdmF0ZSBoZWxwZXIgZnVuY3Rpb25zXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbi8qKlxyXG4gKiBBdHRhY2hlcyBYUmVnRXhwLnByb3RvdHlwZSBwcm9wZXJ0aWVzIGFuZCBuYW1lZCBjYXB0dXJlIHN1cHBvcnRpbmcgZGF0YSB0byBhIHJlZ2V4IG9iamVjdC5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4IFJlZ2V4IHRvIGF1Z21lbnQuXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGNhcHR1cmVOYW1lcyBBcnJheSB3aXRoIGNhcHR1cmUgbmFtZXMsIG9yIG51bGwuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2lzTmF0aXZlXSBXaGV0aGVyIHRoZSByZWdleCB3YXMgY3JlYXRlZCBieSBgUmVnRXhwYCByYXRoZXIgdGhhbiBgWFJlZ0V4cGAuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IEF1Z21lbnRlZCByZWdleC5cclxuICovXHJcbiAgICBmdW5jdGlvbiBhdWdtZW50KHJlZ2V4LCBjYXB0dXJlTmFtZXMsIGlzTmF0aXZlKSB7XHJcbiAgICAgICAgdmFyIHA7XHJcbiAgICAgICAgLy8gQ2FuJ3QgYXV0by1pbmhlcml0IHRoZXNlIHNpbmNlIHRoZSBYUmVnRXhwIGNvbnN0cnVjdG9yIHJldHVybnMgYSBub25wcmltaXRpdmUgdmFsdWVcclxuICAgICAgICBmb3IgKHAgaW4gc2VsZi5wcm90b3R5cGUpIHtcclxuICAgICAgICAgICAgaWYgKHNlbGYucHJvdG90eXBlLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgICAgICByZWdleFtwXSA9IHNlbGYucHJvdG90eXBlW3BdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlZ2V4LnhyZWdleHAgPSB7Y2FwdHVyZU5hbWVzOiBjYXB0dXJlTmFtZXMsIGlzTmF0aXZlOiAhIWlzTmF0aXZlfTtcclxuICAgICAgICByZXR1cm4gcmVnZXg7XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogUmV0dXJucyBuYXRpdmUgYFJlZ0V4cGAgZmxhZ3MgdXNlZCBieSBhIHJlZ2V4IG9iamVjdC5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4IFJlZ2V4IHRvIGNoZWNrLlxyXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBOYXRpdmUgZmxhZ3MgaW4gdXNlLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGdldE5hdGl2ZUZsYWdzKHJlZ2V4KSB7XHJcbiAgICAgICAgLy9yZXR1cm4gbmF0aXYuZXhlYy5jYWxsKC9cXC8oW2Etel0qKSQvaSwgU3RyaW5nKHJlZ2V4KSlbMV07XHJcbiAgICAgICAgcmV0dXJuIChyZWdleC5nbG9iYWwgICAgID8gXCJnXCIgOiBcIlwiKSArXHJcbiAgICAgICAgICAgICAgIChyZWdleC5pZ25vcmVDYXNlID8gXCJpXCIgOiBcIlwiKSArXHJcbiAgICAgICAgICAgICAgIChyZWdleC5tdWx0aWxpbmUgID8gXCJtXCIgOiBcIlwiKSArXHJcbiAgICAgICAgICAgICAgIChyZWdleC5leHRlbmRlZCAgID8gXCJ4XCIgOiBcIlwiKSArIC8vIFByb3Bvc2VkIGZvciBFUzYsIGluY2x1ZGVkIGluIEFTM1xyXG4gICAgICAgICAgICAgICAocmVnZXguc3RpY2t5ICAgICA/IFwieVwiIDogXCJcIik7IC8vIFByb3Bvc2VkIGZvciBFUzYsIGluY2x1ZGVkIGluIEZpcmVmb3ggMytcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBDb3BpZXMgYSByZWdleCBvYmplY3Qgd2hpbGUgcHJlc2VydmluZyBzcGVjaWFsIHByb3BlcnRpZXMgZm9yIG5hbWVkIGNhcHR1cmUgYW5kIGF1Z21lbnRpbmcgd2l0aFxyXG4gKiBgWFJlZ0V4cC5wcm90b3R5cGVgIG1ldGhvZHMuIFRoZSBjb3B5IGhhcyBhIGZyZXNoIGBsYXN0SW5kZXhgIHByb3BlcnR5IChzZXQgdG8gemVybykuIEFsbG93c1xyXG4gKiBhZGRpbmcgYW5kIHJlbW92aW5nIGZsYWdzIHdoaWxlIGNvcHlpbmcgdGhlIHJlZ2V4LlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gY29weS5cclxuICogQHBhcmFtIHtTdHJpbmd9IFthZGRGbGFnc10gRmxhZ3MgdG8gYmUgYWRkZWQgd2hpbGUgY29weWluZyB0aGUgcmVnZXguXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbcmVtb3ZlRmxhZ3NdIEZsYWdzIHRvIGJlIHJlbW92ZWQgd2hpbGUgY29weWluZyB0aGUgcmVnZXguXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IENvcHkgb2YgdGhlIHByb3ZpZGVkIHJlZ2V4LCBwb3NzaWJseSB3aXRoIG1vZGlmaWVkIGZsYWdzLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGNvcHkocmVnZXgsIGFkZEZsYWdzLCByZW1vdmVGbGFncykge1xyXG4gICAgICAgIGlmICghc2VsZi5pc1JlZ0V4cChyZWdleCkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInR5cGUgUmVnRXhwIGV4cGVjdGVkXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgZmxhZ3MgPSBuYXRpdi5yZXBsYWNlLmNhbGwoZ2V0TmF0aXZlRmxhZ3MocmVnZXgpICsgKGFkZEZsYWdzIHx8IFwiXCIpLCBkdXBsaWNhdGVGbGFncywgXCJcIik7XHJcbiAgICAgICAgaWYgKHJlbW92ZUZsYWdzKSB7XHJcbiAgICAgICAgICAgIC8vIFdvdWxkIG5lZWQgdG8gZXNjYXBlIGByZW1vdmVGbGFnc2AgaWYgdGhpcyB3YXMgcHVibGljXHJcbiAgICAgICAgICAgIGZsYWdzID0gbmF0aXYucmVwbGFjZS5jYWxsKGZsYWdzLCBuZXcgUmVnRXhwKFwiW1wiICsgcmVtb3ZlRmxhZ3MgKyBcIl0rXCIsIFwiZ1wiKSwgXCJcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyZWdleC54cmVnZXhwICYmICFyZWdleC54cmVnZXhwLmlzTmF0aXZlKSB7XHJcbiAgICAgICAgICAgIC8vIENvbXBpbGluZyB0aGUgY3VycmVudCAocmF0aGVyIHRoYW4gcHJlY29tcGlsYXRpb24pIHNvdXJjZSBwcmVzZXJ2ZXMgdGhlIGVmZmVjdHMgb2Ygbm9ubmF0aXZlIHNvdXJjZSBmbGFnc1xyXG4gICAgICAgICAgICByZWdleCA9IGF1Z21lbnQoc2VsZihyZWdleC5zb3VyY2UsIGZsYWdzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2V4LnhyZWdleHAuY2FwdHVyZU5hbWVzID8gcmVnZXgueHJlZ2V4cC5jYXB0dXJlTmFtZXMuc2xpY2UoMCkgOiBudWxsKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBdWdtZW50IHdpdGggYFhSZWdFeHAucHJvdG90eXBlYCBtZXRob2RzLCBidXQgdXNlIG5hdGl2ZSBgUmVnRXhwYCAoYXZvaWQgc2VhcmNoaW5nIGZvciBzcGVjaWFsIHRva2VucylcclxuICAgICAgICAgICAgcmVnZXggPSBhdWdtZW50KG5ldyBSZWdFeHAocmVnZXguc291cmNlLCBmbGFncyksIG51bGwsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVnZXg7XHJcbiAgICB9XHJcblxyXG4vKlxyXG4gKiBSZXR1cm5zIHRoZSBsYXN0IGluZGV4IGF0IHdoaWNoIGEgZ2l2ZW4gdmFsdWUgY2FuIGJlIGZvdW5kIGluIGFuIGFycmF5LCBvciBgLTFgIGlmIGl0J3Mgbm90XHJcbiAqIHByZXNlbnQuIFRoZSBhcnJheSBpcyBzZWFyY2hlZCBiYWNrd2FyZHMuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IEFycmF5IHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHsqfSB2YWx1ZSBWYWx1ZSB0byBsb2NhdGUgaW4gdGhlIGFycmF5LlxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBMYXN0IHplcm8tYmFzZWQgaW5kZXggYXQgd2hpY2ggdGhlIGl0ZW0gaXMgZm91bmQsIG9yIC0xLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGxhc3RJbmRleE9mKGFycmF5LCB2YWx1ZSkge1xyXG4gICAgICAgIHZhciBpID0gYXJyYXkubGVuZ3RoO1xyXG4gICAgICAgIGlmIChBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGFycmF5Lmxhc3RJbmRleE9mKHZhbHVlKTsgLy8gVXNlIHRoZSBuYXRpdmUgbWV0aG9kIGlmIGF2YWlsYWJsZVxyXG4gICAgICAgIH1cclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIGlmIChhcnJheVtpXSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAtMTtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgYW4gb2JqZWN0IGlzIG9mIHRoZSBzcGVjaWZpZWQgdHlwZS5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHsqfSB2YWx1ZSBPYmplY3QgdG8gY2hlY2suXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFR5cGUgdG8gY2hlY2sgZm9yLCBpbiBsb3dlcmNhc2UuXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSBvYmplY3QgbWF0Y2hlcyB0aGUgdHlwZS5cclxuICovXHJcbiAgICBmdW5jdGlvbiBpc1R5cGUodmFsdWUsIHR5cGUpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKS50b0xvd2VyQ2FzZSgpID09PSBcIltvYmplY3QgXCIgKyB0eXBlICsgXCJdXCI7XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogUHJlcGFyZXMgYW4gb3B0aW9ucyBvYmplY3QgZnJvbSB0aGUgZ2l2ZW4gdmFsdWUuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gdmFsdWUgVmFsdWUgdG8gY29udmVydCB0byBhbiBvcHRpb25zIG9iamVjdC5cclxuICogQHJldHVybnMge09iamVjdH0gT3B0aW9ucyBvYmplY3QuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gcHJlcGFyZU9wdGlvbnModmFsdWUpIHtcclxuICAgICAgICB2YWx1ZSA9IHZhbHVlIHx8IHt9O1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gXCJhbGxcIiB8fCB2YWx1ZS5hbGwpIHtcclxuICAgICAgICAgICAgdmFsdWUgPSB7bmF0aXZlczogdHJ1ZSwgZXh0ZW5zaWJpbGl0eTogdHJ1ZX07XHJcbiAgICAgICAgfSBlbHNlIGlmIChpc1R5cGUodmFsdWUsIFwic3RyaW5nXCIpKSB7XHJcbiAgICAgICAgICAgIHZhbHVlID0gc2VsZi5mb3JFYWNoKHZhbHVlLCAvW15cXHMsXSsvLCBmdW5jdGlvbiAobSkge1xyXG4gICAgICAgICAgICAgICAgdGhpc1ttXSA9IHRydWU7XHJcbiAgICAgICAgICAgIH0sIHt9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIFJ1bnMgYnVpbHQtaW4vY3VzdG9tIHRva2VucyBpbiByZXZlcnNlIGluc2VydGlvbiBvcmRlciwgdW50aWwgYSBtYXRjaCBpcyBmb3VuZC5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtTdHJpbmd9IHBhdHRlcm4gT3JpZ2luYWwgcGF0dGVybiBmcm9tIHdoaWNoIGFuIFhSZWdFeHAgb2JqZWN0IGlzIGJlaW5nIGJ1aWx0LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zIFBvc2l0aW9uIHRvIHNlYXJjaCBmb3IgdG9rZW5zIHdpdGhpbiBgcGF0dGVybmAuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBzY29wZSBDdXJyZW50IHJlZ2V4IHNjb3BlLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCBDb250ZXh0IG9iamVjdCBhc3NpZ25lZCB0byB0b2tlbiBoYW5kbGVyIGZ1bmN0aW9ucy5cclxuICogQHJldHVybnMge09iamVjdH0gT2JqZWN0IHdpdGggcHJvcGVydGllcyBgb3V0cHV0YCAodGhlIHN1YnN0aXR1dGlvbiBzdHJpbmcgcmV0dXJuZWQgYnkgdGhlXHJcbiAqICAgc3VjY2Vzc2Z1bCB0b2tlbiBoYW5kbGVyKSBhbmQgYG1hdGNoYCAodGhlIHRva2VuJ3MgbWF0Y2ggYXJyYXkpLCBvciBudWxsLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIHJ1blRva2VucyhwYXR0ZXJuLCBwb3MsIHNjb3BlLCBjb250ZXh0KSB7XHJcbiAgICAgICAgdmFyIGkgPSB0b2tlbnMubGVuZ3RoLFxyXG4gICAgICAgICAgICByZXN1bHQgPSBudWxsLFxyXG4gICAgICAgICAgICBtYXRjaCxcclxuICAgICAgICAgICAgdDtcclxuICAgICAgICAvLyBQcm90ZWN0IGFnYWluc3QgY29uc3RydWN0aW5nIFhSZWdFeHBzIHdpdGhpbiB0b2tlbiBoYW5kbGVyIGFuZCB0cmlnZ2VyIGZ1bmN0aW9uc1xyXG4gICAgICAgIGlzSW5zaWRlQ29uc3RydWN0b3IgPSB0cnVlO1xyXG4gICAgICAgIC8vIE11c3QgcmVzZXQgYGlzSW5zaWRlQ29uc3RydWN0b3JgLCBldmVuIGlmIGEgYHRyaWdnZXJgIG9yIGBoYW5kbGVyYCB0aHJvd3NcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7IC8vIFJ1biBpbiByZXZlcnNlIG9yZGVyXHJcbiAgICAgICAgICAgICAgICB0ID0gdG9rZW5zW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKCh0LnNjb3BlID09PSBcImFsbFwiIHx8IHQuc2NvcGUgPT09IHNjb3BlKSAmJiAoIXQudHJpZ2dlciB8fCB0LnRyaWdnZXIuY2FsbChjb250ZXh0KSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0LnBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gZml4ZWQuZXhlYy5jYWxsKHQucGF0dGVybiwgcGF0dGVybik7IC8vIEZpeGVkIGBleGVjYCBoZXJlIGFsbG93cyB1c2Ugb2YgbmFtZWQgYmFja3JlZmVyZW5jZXMsIGV0Yy5cclxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2guaW5kZXggPT09IHBvcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IHQuaGFuZGxlci5jYWxsKGNvbnRleHQsIG1hdGNoLCBzY29wZSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaDogbWF0Y2hcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHRocm93IGVycjtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICBpc0luc2lkZUNvbnN0cnVjdG9yID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogRW5hYmxlcyBvciBkaXNhYmxlcyBYUmVnRXhwIHN5bnRheCBhbmQgZmxhZyBleHRlbnNpYmlsaXR5LlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9uIGB0cnVlYCB0byBlbmFibGU7IGBmYWxzZWAgdG8gZGlzYWJsZS5cclxuICovXHJcbiAgICBmdW5jdGlvbiBzZXRFeHRlbnNpYmlsaXR5KG9uKSB7XHJcbiAgICAgICAgc2VsZi5hZGRUb2tlbiA9IGFkZFRva2VuW29uID8gXCJvblwiIDogXCJvZmZcIl07XHJcbiAgICAgICAgZmVhdHVyZXMuZXh0ZW5zaWJpbGl0eSA9IG9uO1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgbmF0aXZlIG1ldGhvZCBvdmVycmlkZXMuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb24gYHRydWVgIHRvIGVuYWJsZTsgYGZhbHNlYCB0byBkaXNhYmxlLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIHNldE5hdGl2ZXMob24pIHtcclxuICAgICAgICBSZWdFeHAucHJvdG90eXBlLmV4ZWMgPSAob24gPyBmaXhlZCA6IG5hdGl2KS5leGVjO1xyXG4gICAgICAgIFJlZ0V4cC5wcm90b3R5cGUudGVzdCA9IChvbiA/IGZpeGVkIDogbmF0aXYpLnRlc3Q7XHJcbiAgICAgICAgU3RyaW5nLnByb3RvdHlwZS5tYXRjaCA9IChvbiA/IGZpeGVkIDogbmF0aXYpLm1hdGNoO1xyXG4gICAgICAgIFN0cmluZy5wcm90b3R5cGUucmVwbGFjZSA9IChvbiA/IGZpeGVkIDogbmF0aXYpLnJlcGxhY2U7XHJcbiAgICAgICAgU3RyaW5nLnByb3RvdHlwZS5zcGxpdCA9IChvbiA/IGZpeGVkIDogbmF0aXYpLnNwbGl0O1xyXG4gICAgICAgIGZlYXR1cmVzLm5hdGl2ZXMgPSBvbjtcclxuICAgIH1cclxuXHJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvbnN0cnVjdG9yXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGFuIGV4dGVuZGVkIHJlZ3VsYXIgZXhwcmVzc2lvbiBvYmplY3QgZm9yIG1hdGNoaW5nIHRleHQgd2l0aCBhIHBhdHRlcm4uIERpZmZlcnMgZnJvbSBhXHJcbiAqIG5hdGl2ZSByZWd1bGFyIGV4cHJlc3Npb24gaW4gdGhhdCBhZGRpdGlvbmFsIHN5bnRheCBhbmQgZmxhZ3MgYXJlIHN1cHBvcnRlZC4gVGhlIHJldHVybmVkIG9iamVjdFxyXG4gKiBpcyBpbiBmYWN0IGEgbmF0aXZlIGBSZWdFeHBgIGFuZCB3b3JrcyB3aXRoIGFsbCBuYXRpdmUgbWV0aG9kcy5cclxuICogQGNsYXNzIFhSZWdFeHBcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFJlZ0V4cH0gcGF0dGVybiBSZWdleCBwYXR0ZXJuIHN0cmluZywgb3IgYW4gZXhpc3RpbmcgYFJlZ0V4cGAgb2JqZWN0IHRvIGNvcHkuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZmxhZ3NdIEFueSBjb21iaW5hdGlvbiBvZiBmbGFnczpcclxuICogICA8bGk+YGdgIC0gZ2xvYmFsXHJcbiAqICAgPGxpPmBpYCAtIGlnbm9yZSBjYXNlXHJcbiAqICAgPGxpPmBtYCAtIG11bHRpbGluZSBhbmNob3JzXHJcbiAqICAgPGxpPmBuYCAtIGV4cGxpY2l0IGNhcHR1cmVcclxuICogICA8bGk+YHNgIC0gZG90IG1hdGNoZXMgYWxsIChha2Egc2luZ2xlbGluZSlcclxuICogICA8bGk+YHhgIC0gZnJlZS1zcGFjaW5nIGFuZCBsaW5lIGNvbW1lbnRzIChha2EgZXh0ZW5kZWQpXHJcbiAqICAgPGxpPmB5YCAtIHN0aWNreSAoRmlyZWZveCAzKyBvbmx5KVxyXG4gKiAgIEZsYWdzIGNhbm5vdCBiZSBwcm92aWRlZCB3aGVuIGNvbnN0cnVjdGluZyBvbmUgYFJlZ0V4cGAgZnJvbSBhbm90aGVyLlxyXG4gKiBAcmV0dXJucyB7UmVnRXhwfSBFeHRlbmRlZCByZWd1bGFyIGV4cHJlc3Npb24gb2JqZWN0LlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBXaXRoIG5hbWVkIGNhcHR1cmUgYW5kIGZsYWcgeFxyXG4gKiBkYXRlID0gWFJlZ0V4cCgnKD88eWVhcj4gIFswLTldezR9KSAtPyAgIyB5ZWFyICBcXG5cXFxyXG4gKiAgICAgICAgICAgICAgICAgKD88bW9udGg+IFswLTldezJ9KSAtPyAgIyBtb250aCBcXG5cXFxyXG4gKiAgICAgICAgICAgICAgICAgKD88ZGF5PiAgIFswLTldezJ9KSAgICAgIyBkYXkgICAnLCAneCcpO1xyXG4gKlxyXG4gKiAvLyBQYXNzaW5nIGEgcmVnZXggb2JqZWN0IHRvIGNvcHkgaXQuIFRoZSBjb3B5IG1haW50YWlucyBzcGVjaWFsIHByb3BlcnRpZXMgZm9yIG5hbWVkIGNhcHR1cmUsXHJcbiAqIC8vIGlzIGF1Z21lbnRlZCB3aXRoIGBYUmVnRXhwLnByb3RvdHlwZWAgbWV0aG9kcywgYW5kIGhhcyBhIGZyZXNoIGBsYXN0SW5kZXhgIHByb3BlcnR5IChzZXQgdG9cclxuICogLy8gemVybykuIE5hdGl2ZSByZWdleGVzIGFyZSBub3QgcmVjb21waWxlZCB1c2luZyBYUmVnRXhwIHN5bnRheC5cclxuICogWFJlZ0V4cCgvcmVnZXgvKTtcclxuICovXHJcbiAgICBzZWxmID0gZnVuY3Rpb24gKHBhdHRlcm4sIGZsYWdzKSB7XHJcbiAgICAgICAgaWYgKHNlbGYuaXNSZWdFeHAocGF0dGVybikpIHtcclxuICAgICAgICAgICAgaWYgKGZsYWdzICE9PSB1bmRlZikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbid0IHN1cHBseSBmbGFncyB3aGVuIGNvbnN0cnVjdGluZyBvbmUgUmVnRXhwIGZyb20gYW5vdGhlclwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gY29weShwYXR0ZXJuKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gVG9rZW5zIGJlY29tZSBwYXJ0IG9mIHRoZSByZWdleCBjb25zdHJ1Y3Rpb24gcHJvY2Vzcywgc28gcHJvdGVjdCBhZ2FpbnN0IGluZmluaXRlIHJlY3Vyc2lvblxyXG4gICAgICAgIC8vIHdoZW4gYW4gWFJlZ0V4cCBpcyBjb25zdHJ1Y3RlZCB3aXRoaW4gYSB0b2tlbiBoYW5kbGVyIGZ1bmN0aW9uXHJcbiAgICAgICAgaWYgKGlzSW5zaWRlQ29uc3RydWN0b3IpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FuJ3QgY2FsbCB0aGUgWFJlZ0V4cCBjb25zdHJ1Y3RvciB3aXRoaW4gdG9rZW4gZGVmaW5pdGlvbiBmdW5jdGlvbnNcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgb3V0cHV0ID0gW10sXHJcbiAgICAgICAgICAgIHNjb3BlID0gZGVmYXVsdFNjb3BlLFxyXG4gICAgICAgICAgICB0b2tlbkNvbnRleHQgPSB7XHJcbiAgICAgICAgICAgICAgICBoYXNOYW1lZENhcHR1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgY2FwdHVyZU5hbWVzOiBbXSxcclxuICAgICAgICAgICAgICAgIGhhc0ZsYWc6IGZ1bmN0aW9uIChmbGFnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZsYWdzLmluZGV4T2YoZmxhZykgPiAtMTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcG9zID0gMCxcclxuICAgICAgICAgICAgdG9rZW5SZXN1bHQsXHJcbiAgICAgICAgICAgIG1hdGNoLFxyXG4gICAgICAgICAgICBjaHI7XHJcbiAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4gPT09IHVuZGVmID8gXCJcIiA6IFN0cmluZyhwYXR0ZXJuKTtcclxuICAgICAgICBmbGFncyA9IGZsYWdzID09PSB1bmRlZiA/IFwiXCIgOiBTdHJpbmcoZmxhZ3MpO1xyXG5cclxuICAgICAgICBpZiAobmF0aXYubWF0Y2guY2FsbChmbGFncywgZHVwbGljYXRlRmxhZ3MpKSB7IC8vIERvbid0IHVzZSB0ZXN0L2V4ZWMgYmVjYXVzZSB0aGV5IHdvdWxkIHVwZGF0ZSBsYXN0SW5kZXhcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiaW52YWxpZCBkdXBsaWNhdGUgcmVndWxhciBleHByZXNzaW9uIGZsYWdcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFN0cmlwL2FwcGx5IGxlYWRpbmcgbW9kZSBtb2RpZmllciB3aXRoIGFueSBjb21iaW5hdGlvbiBvZiBmbGFncyBleGNlcHQgZyBvciB5OiAoP2ltbnN4KVxyXG4gICAgICAgIHBhdHRlcm4gPSBuYXRpdi5yZXBsYWNlLmNhbGwocGF0dGVybiwgL15cXChcXD8oW1xcdyRdKylcXCkvLCBmdW5jdGlvbiAoJDAsICQxKSB7XHJcbiAgICAgICAgICAgIGlmIChuYXRpdi50ZXN0LmNhbGwoL1tneV0vLCAkMSkpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImNhbid0IHVzZSBmbGFnIGcgb3IgeSBpbiBtb2RlIG1vZGlmaWVyXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZsYWdzID0gbmF0aXYucmVwbGFjZS5jYWxsKGZsYWdzICsgJDEsIGR1cGxpY2F0ZUZsYWdzLCBcIlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgc2VsZi5mb3JFYWNoKGZsYWdzLCAvW1xcc1xcU10vLCBmdW5jdGlvbiAobSkge1xyXG4gICAgICAgICAgICBpZiAocmVnaXN0ZXJlZEZsYWdzLmluZGV4T2YobVswXSkgPCAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJpbnZhbGlkIHJlZ3VsYXIgZXhwcmVzc2lvbiBmbGFnIFwiICsgbVswXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHBvcyA8IHBhdHRlcm4ubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBjdXN0b20gdG9rZW5zIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uXHJcbiAgICAgICAgICAgIHRva2VuUmVzdWx0ID0gcnVuVG9rZW5zKHBhdHRlcm4sIHBvcywgc2NvcGUsIHRva2VuQ29udGV4dCk7XHJcbiAgICAgICAgICAgIGlmICh0b2tlblJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2godG9rZW5SZXN1bHQub3V0cHV0KTtcclxuICAgICAgICAgICAgICAgIHBvcyArPSAodG9rZW5SZXN1bHQubWF0Y2hbMF0ubGVuZ3RoIHx8IDEpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIG5hdGl2ZSB0b2tlbnMgKGV4Y2VwdCBjaGFyYWN0ZXIgY2xhc3NlcykgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgICAgIG1hdGNoID0gbmF0aXYuZXhlYy5jYWxsKG5hdGl2ZVRva2Vuc1tzY29wZV0sIHBhdHRlcm4uc2xpY2UocG9zKSk7XHJcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChtYXRjaFswXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcG9zICs9IG1hdGNoWzBdLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2hyID0gcGF0dGVybi5jaGFyQXQocG9zKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY2hyID09PSBcIltcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzY29wZSA9IGNsYXNzU2NvcGU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09IFwiXVwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlID0gZGVmYXVsdFNjb3BlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyBBZHZhbmNlIHBvc2l0aW9uIGJ5IG9uZSBjaGFyYWN0ZXJcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChjaHIpO1xyXG4gICAgICAgICAgICAgICAgICAgICsrcG9zO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gYXVnbWVudChuZXcgUmVnRXhwKG91dHB1dC5qb2luKFwiXCIpLCBuYXRpdi5yZXBsYWNlLmNhbGwoZmxhZ3MsIC9bXmdpbXldKy9nLCBcIlwiKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgdG9rZW5Db250ZXh0Lmhhc05hbWVkQ2FwdHVyZSA/IHRva2VuQ29udGV4dC5jYXB0dXJlTmFtZXMgOiBudWxsKTtcclxuICAgIH07XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBQdWJsaWMgbWV0aG9kcy9wcm9wZXJ0aWVzXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbi8vIEluc3RhbGxlZCBhbmQgdW5pbnN0YWxsZWQgc3RhdGVzIGZvciBgWFJlZ0V4cC5hZGRUb2tlbmBcclxuICAgIGFkZFRva2VuID0ge1xyXG4gICAgICAgIG9uOiBmdW5jdGlvbiAocmVnZXgsIGhhbmRsZXIsIG9wdGlvbnMpIHtcclxuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICAgICAgICAgIGlmIChyZWdleCkge1xyXG4gICAgICAgICAgICAgICAgdG9rZW5zLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIHBhdHRlcm46IGNvcHkocmVnZXgsIFwiZ1wiICsgKGhhc05hdGl2ZVkgPyBcInlcIiA6IFwiXCIpKSxcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyLFxyXG4gICAgICAgICAgICAgICAgICAgIHNjb3BlOiBvcHRpb25zLnNjb3BlIHx8IGRlZmF1bHRTY29wZSxcclxuICAgICAgICAgICAgICAgICAgICB0cmlnZ2VyOiBvcHRpb25zLnRyaWdnZXIgfHwgbnVsbFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gUHJvdmlkaW5nIGBjdXN0b21GbGFnc2Agd2l0aCBudWxsIGByZWdleGAgYW5kIGBoYW5kbGVyYCBhbGxvd3MgYWRkaW5nIGZsYWdzIHRoYXQgZG9cclxuICAgICAgICAgICAgLy8gbm90aGluZywgYnV0IGRvbid0IHRocm93IGFuIGVycm9yXHJcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmN1c3RvbUZsYWdzKSB7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RlcmVkRmxhZ3MgPSBuYXRpdi5yZXBsYWNlLmNhbGwocmVnaXN0ZXJlZEZsYWdzICsgb3B0aW9ucy5jdXN0b21GbGFncywgZHVwbGljYXRlRmxhZ3MsIFwiXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvZmY6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXh0ZW5zaWJpbGl0eSBtdXN0IGJlIGluc3RhbGxlZCBiZWZvcmUgdXNpbmcgYWRkVG9rZW5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBFeHRlbmRzIG9yIGNoYW5nZXMgWFJlZ0V4cCBzeW50YXggYW5kIGFsbG93cyBjdXN0b20gZmxhZ3MuIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5IGFuZCBjYW4gYmVcclxuICogdXNlZCB0byBjcmVhdGUgWFJlZ0V4cCBhZGRvbnMuIGBYUmVnRXhwLmluc3RhbGwoJ2V4dGVuc2liaWxpdHknKWAgbXVzdCBiZSBydW4gYmVmb3JlIGNhbGxpbmdcclxuICogdGhpcyBmdW5jdGlvbiwgb3IgYW4gZXJyb3IgaXMgdGhyb3duLiBJZiBtb3JlIHRoYW4gb25lIHRva2VuIGNhbiBtYXRjaCB0aGUgc2FtZSBzdHJpbmcsIHRoZSBsYXN0XHJcbiAqIGFkZGVkIHdpbnMuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdleCBSZWdleCBvYmplY3QgdGhhdCBtYXRjaGVzIHRoZSBuZXcgdG9rZW4uXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXIgRnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgbmV3IHBhdHRlcm4gc3RyaW5nICh1c2luZyBuYXRpdmUgcmVnZXggc3ludGF4KVxyXG4gKiAgIHRvIHJlcGxhY2UgdGhlIG1hdGNoZWQgdG9rZW4gd2l0aGluIGFsbCBmdXR1cmUgWFJlZ0V4cCByZWdleGVzLiBIYXMgYWNjZXNzIHRvIHBlcnNpc3RlbnRcclxuICogICBwcm9wZXJ0aWVzIG9mIHRoZSByZWdleCBiZWluZyBidWlsdCwgdGhyb3VnaCBgdGhpc2AuIEludm9rZWQgd2l0aCB0d28gYXJndW1lbnRzOlxyXG4gKiAgIDxsaT5UaGUgbWF0Y2ggYXJyYXksIHdpdGggbmFtZWQgYmFja3JlZmVyZW5jZSBwcm9wZXJ0aWVzLlxyXG4gKiAgIDxsaT5UaGUgcmVnZXggc2NvcGUgd2hlcmUgdGhlIG1hdGNoIHdhcyBmb3VuZC5cclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBPcHRpb25zIG9iamVjdCB3aXRoIG9wdGlvbmFsIHByb3BlcnRpZXM6XHJcbiAqICAgPGxpPmBzY29wZWAge1N0cmluZ30gU2NvcGVzIHdoZXJlIHRoZSB0b2tlbiBhcHBsaWVzOiAnZGVmYXVsdCcsICdjbGFzcycsIG9yICdhbGwnLlxyXG4gKiAgIDxsaT5gdHJpZ2dlcmAge0Z1bmN0aW9ufSBGdW5jdGlvbiB0aGF0IHJldHVybnMgYHRydWVgIHdoZW4gdGhlIHRva2VuIHNob3VsZCBiZSBhcHBsaWVkOyBlLmcuLFxyXG4gKiAgICAgaWYgYSBmbGFnIGlzIHNldC4gSWYgYGZhbHNlYCBpcyByZXR1cm5lZCwgdGhlIG1hdGNoZWQgc3RyaW5nIGNhbiBiZSBtYXRjaGVkIGJ5IG90aGVyIHRva2Vucy5cclxuICogICAgIEhhcyBhY2Nlc3MgdG8gcGVyc2lzdGVudCBwcm9wZXJ0aWVzIG9mIHRoZSByZWdleCBiZWluZyBidWlsdCwgdGhyb3VnaCBgdGhpc2AgKGluY2x1ZGluZ1xyXG4gKiAgICAgZnVuY3Rpb24gYHRoaXMuaGFzRmxhZ2ApLlxyXG4gKiAgIDxsaT5gY3VzdG9tRmxhZ3NgIHtTdHJpbmd9IE5vbm5hdGl2ZSBmbGFncyB1c2VkIGJ5IHRoZSB0b2tlbidzIGhhbmRsZXIgb3IgdHJpZ2dlciBmdW5jdGlvbnMuXHJcbiAqICAgICBQcmV2ZW50cyBYUmVnRXhwIGZyb20gdGhyb3dpbmcgYW4gaW52YWxpZCBmbGFnIGVycm9yIHdoZW4gdGhlIHNwZWNpZmllZCBmbGFncyBhcmUgdXNlZC5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gQmFzaWMgdXNhZ2U6IEFkZHMgXFxhIGZvciBBTEVSVCBjaGFyYWN0ZXJcclxuICogWFJlZ0V4cC5hZGRUb2tlbihcclxuICogICAvXFxcXGEvLFxyXG4gKiAgIGZ1bmN0aW9uICgpIHtyZXR1cm4gJ1xcXFx4MDcnO30sXHJcbiAqICAge3Njb3BlOiAnYWxsJ31cclxuICogKTtcclxuICogWFJlZ0V4cCgnXFxcXGFbXFxcXGEtXFxcXG5dKycpLnRlc3QoJ1xceDA3XFxuXFx4MDcnKTsgLy8gLT4gdHJ1ZVxyXG4gKi9cclxuICAgIHNlbGYuYWRkVG9rZW4gPSBhZGRUb2tlbi5vZmY7XHJcblxyXG4vKipcclxuICogQ2FjaGVzIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgb2YgY2FsbGluZyBgWFJlZ0V4cChwYXR0ZXJuLCBmbGFncylgLiBPbiBhbnkgc3Vic2VxdWVudCBjYWxsIHdpdGhcclxuICogdGhlIHNhbWUgcGF0dGVybiBhbmQgZmxhZyBjb21iaW5hdGlvbiwgdGhlIGNhY2hlZCBjb3B5IGlzIHJldHVybmVkLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0dGVybiBSZWdleCBwYXR0ZXJuIHN0cmluZy5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtmbGFnc10gQW55IGNvbWJpbmF0aW9uIG9mIFhSZWdFeHAgZmxhZ3MuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IENhY2hlZCBYUmVnRXhwIG9iamVjdC5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogd2hpbGUgKG1hdGNoID0gWFJlZ0V4cC5jYWNoZSgnLicsICdncycpLmV4ZWMoc3RyKSkge1xyXG4gKiAgIC8vIFRoZSByZWdleCBpcyBjb21waWxlZCBvbmNlIG9ubHlcclxuICogfVxyXG4gKi9cclxuICAgIHNlbGYuY2FjaGUgPSBmdW5jdGlvbiAocGF0dGVybiwgZmxhZ3MpIHtcclxuICAgICAgICB2YXIga2V5ID0gcGF0dGVybiArIFwiL1wiICsgKGZsYWdzIHx8IFwiXCIpO1xyXG4gICAgICAgIHJldHVybiBjYWNoZVtrZXldIHx8IChjYWNoZVtrZXldID0gc2VsZihwYXR0ZXJuLCBmbGFncykpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBFc2NhcGVzIGFueSByZWd1bGFyIGV4cHJlc3Npb24gbWV0YWNoYXJhY3RlcnMsIGZvciB1c2Ugd2hlbiBtYXRjaGluZyBsaXRlcmFsIHN0cmluZ3MuIFRoZSByZXN1bHRcclxuICogY2FuIHNhZmVseSBiZSB1c2VkIGF0IGFueSBwb2ludCB3aXRoaW4gYSByZWdleCB0aGF0IHVzZXMgYW55IGZsYWdzLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBlc2NhcGUuXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IFN0cmluZyB3aXRoIHJlZ2V4IG1ldGFjaGFyYWN0ZXJzIGVzY2FwZWQuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAuZXNjYXBlKCdFc2NhcGVkPyA8Lj4nKTtcclxuICogLy8gLT4gJ0VzY2FwZWRcXD9cXCA8XFwuPidcclxuICovXHJcbiAgICBzZWxmLmVzY2FwZSA9IGZ1bmN0aW9uIChzdHIpIHtcclxuICAgICAgICByZXR1cm4gbmF0aXYucmVwbGFjZS5jYWxsKHN0ciwgL1stW1xcXXt9KCkqKz8uLFxcXFxeJHwjXFxzXS9nLCBcIlxcXFwkJlwiKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogRXhlY3V0ZXMgYSByZWdleCBzZWFyY2ggaW4gYSBzcGVjaWZpZWQgc3RyaW5nLiBSZXR1cm5zIGEgbWF0Y2ggYXJyYXkgb3IgYG51bGxgLiBJZiB0aGUgcHJvdmlkZWRcclxuICogcmVnZXggdXNlcyBuYW1lZCBjYXB0dXJlLCBuYW1lZCBiYWNrcmVmZXJlbmNlIHByb3BlcnRpZXMgYXJlIGluY2x1ZGVkIG9uIHRoZSBtYXRjaCBhcnJheS5cclxuICogT3B0aW9uYWwgYHBvc2AgYW5kIGBzdGlja3lgIGFyZ3VtZW50cyBzcGVjaWZ5IHRoZSBzZWFyY2ggc3RhcnQgcG9zaXRpb24sIGFuZCB3aGV0aGVyIHRoZSBtYXRjaFxyXG4gKiBtdXN0IHN0YXJ0IGF0IHRoZSBzcGVjaWZpZWQgcG9zaXRpb24gb25seS4gVGhlIGBsYXN0SW5kZXhgIHByb3BlcnR5IG9mIHRoZSBwcm92aWRlZCByZWdleCBpcyBub3RcclxuICogdXNlZCwgYnV0IGlzIHVwZGF0ZWQgZm9yIGNvbXBhdGliaWxpdHkuIEFsc28gZml4ZXMgYnJvd3NlciBidWdzIGNvbXBhcmVkIHRvIHRoZSBuYXRpdmVcclxuICogYFJlZ0V4cC5wcm90b3R5cGUuZXhlY2AgYW5kIGNhbiBiZSB1c2VkIHJlbGlhYmx5IGNyb3NzLWJyb3dzZXIuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4IFJlZ2V4IHRvIHNlYXJjaCB3aXRoLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gW3Bvcz0wXSBaZXJvLWJhc2VkIGluZGV4IGF0IHdoaWNoIHRvIHN0YXJ0IHRoZSBzZWFyY2guXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbnxTdHJpbmd9IFtzdGlja3k9ZmFsc2VdIFdoZXRoZXIgdGhlIG1hdGNoIG11c3Qgc3RhcnQgYXQgdGhlIHNwZWNpZmllZCBwb3NpdGlvblxyXG4gKiAgIG9ubHkuIFRoZSBzdHJpbmcgYCdzdGlja3knYCBpcyBhY2NlcHRlZCBhcyBhbiBhbHRlcm5hdGl2ZSB0byBgdHJ1ZWAuXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gTWF0Y2ggYXJyYXkgd2l0aCBuYW1lZCBiYWNrcmVmZXJlbmNlIHByb3BlcnRpZXMsIG9yIG51bGwuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEJhc2ljIHVzZSwgd2l0aCBuYW1lZCBiYWNrcmVmZXJlbmNlXHJcbiAqIHZhciBtYXRjaCA9IFhSZWdFeHAuZXhlYygnVSsyNjIwJywgWFJlZ0V4cCgnVVxcXFwrKD88aGV4PlswLTlBLUZdezR9KScpKTtcclxuICogbWF0Y2guaGV4OyAvLyAtPiAnMjYyMCdcclxuICpcclxuICogLy8gV2l0aCBwb3MgYW5kIHN0aWNreSwgaW4gYSBsb29wXHJcbiAqIHZhciBwb3MgPSAyLCByZXN1bHQgPSBbXSwgbWF0Y2g7XHJcbiAqIHdoaWxlIChtYXRjaCA9IFhSZWdFeHAuZXhlYygnPDE+PDI+PDM+PDQ+NTw2PicsIC88KFxcZCk+LywgcG9zLCAnc3RpY2t5JykpIHtcclxuICogICByZXN1bHQucHVzaChtYXRjaFsxXSk7XHJcbiAqICAgcG9zID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XHJcbiAqIH1cclxuICogLy8gcmVzdWx0IC0+IFsnMicsICczJywgJzQnXVxyXG4gKi9cclxuICAgIHNlbGYuZXhlYyA9IGZ1bmN0aW9uIChzdHIsIHJlZ2V4LCBwb3MsIHN0aWNreSkge1xyXG4gICAgICAgIHZhciByMiA9IGNvcHkocmVnZXgsIFwiZ1wiICsgKHN0aWNreSAmJiBoYXNOYXRpdmVZID8gXCJ5XCIgOiBcIlwiKSwgKHN0aWNreSA9PT0gZmFsc2UgPyBcInlcIiA6IFwiXCIpKSxcclxuICAgICAgICAgICAgbWF0Y2g7XHJcbiAgICAgICAgcjIubGFzdEluZGV4ID0gcG9zID0gcG9zIHx8IDA7XHJcbiAgICAgICAgbWF0Y2ggPSBmaXhlZC5leGVjLmNhbGwocjIsIHN0cik7IC8vIEZpeGVkIGBleGVjYCByZXF1aXJlZCBmb3IgYGxhc3RJbmRleGAgZml4LCBldGMuXHJcbiAgICAgICAgaWYgKHN0aWNreSAmJiBtYXRjaCAmJiBtYXRjaC5pbmRleCAhPT0gcG9zKSB7XHJcbiAgICAgICAgICAgIG1hdGNoID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlZ2V4Lmdsb2JhbCkge1xyXG4gICAgICAgICAgICByZWdleC5sYXN0SW5kZXggPSBtYXRjaCA/IHIyLmxhc3RJbmRleCA6IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBtYXRjaDtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogRXhlY3V0ZXMgYSBwcm92aWRlZCBmdW5jdGlvbiBvbmNlIHBlciByZWdleCBtYXRjaC5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gc2VhcmNoIHdpdGguXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGV4ZWN1dGUgZm9yIGVhY2ggbWF0Y2guIEludm9rZWQgd2l0aCBmb3VyIGFyZ3VtZW50czpcclxuICogICA8bGk+VGhlIG1hdGNoIGFycmF5LCB3aXRoIG5hbWVkIGJhY2tyZWZlcmVuY2UgcHJvcGVydGllcy5cclxuICogICA8bGk+VGhlIHplcm8tYmFzZWQgbWF0Y2ggaW5kZXguXHJcbiAqICAgPGxpPlRoZSBzdHJpbmcgYmVpbmcgdHJhdmVyc2VkLlxyXG4gKiAgIDxsaT5UaGUgcmVnZXggb2JqZWN0IGJlaW5nIHVzZWQgdG8gdHJhdmVyc2UgdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHsqfSBbY29udGV4dF0gT2JqZWN0IHRvIHVzZSBhcyBgdGhpc2Agd2hlbiBleGVjdXRpbmcgYGNhbGxiYWNrYC5cclxuICogQHJldHVybnMgeyp9IFByb3ZpZGVkIGBjb250ZXh0YCBvYmplY3QuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEV4dHJhY3RzIGV2ZXJ5IG90aGVyIGRpZ2l0IGZyb20gYSBzdHJpbmdcclxuICogWFJlZ0V4cC5mb3JFYWNoKCcxYTIzNDUnLCAvXFxkLywgZnVuY3Rpb24gKG1hdGNoLCBpKSB7XHJcbiAqICAgaWYgKGkgJSAyKSB0aGlzLnB1c2goK21hdGNoWzBdKTtcclxuICogfSwgW10pO1xyXG4gKiAvLyAtPiBbMiwgNF1cclxuICovXHJcbiAgICBzZWxmLmZvckVhY2ggPSBmdW5jdGlvbiAoc3RyLCByZWdleCwgY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuICAgICAgICB2YXIgcG9zID0gMCxcclxuICAgICAgICAgICAgaSA9IC0xLFxyXG4gICAgICAgICAgICBtYXRjaDtcclxuICAgICAgICB3aGlsZSAoKG1hdGNoID0gc2VsZi5leGVjKHN0ciwgcmVnZXgsIHBvcykpKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCwgbWF0Y2gsICsraSwgc3RyLCByZWdleCk7XHJcbiAgICAgICAgICAgIHBvcyA9IG1hdGNoLmluZGV4ICsgKG1hdGNoWzBdLmxlbmd0aCB8fCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNvbnRleHQ7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIENvcGllcyBhIHJlZ2V4IG9iamVjdCBhbmQgYWRkcyBmbGFnIGBnYC4gVGhlIGNvcHkgbWFpbnRhaW5zIHNwZWNpYWwgcHJvcGVydGllcyBmb3IgbmFtZWRcclxuICogY2FwdHVyZSwgaXMgYXVnbWVudGVkIHdpdGggYFhSZWdFeHAucHJvdG90eXBlYCBtZXRob2RzLCBhbmQgaGFzIGEgZnJlc2ggYGxhc3RJbmRleGAgcHJvcGVydHlcclxuICogKHNldCB0byB6ZXJvKS4gTmF0aXZlIHJlZ2V4ZXMgYXJlIG5vdCByZWNvbXBpbGVkIHVzaW5nIFhSZWdFeHAgc3ludGF4LlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gZ2xvYmFsaXplLlxyXG4gKiBAcmV0dXJucyB7UmVnRXhwfSBDb3B5IG9mIHRoZSBwcm92aWRlZCByZWdleCB3aXRoIGZsYWcgYGdgIGFkZGVkLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiB2YXIgZ2xvYmFsQ29weSA9IFhSZWdFeHAuZ2xvYmFsaXplKC9yZWdleC8pO1xyXG4gKiBnbG9iYWxDb3B5Lmdsb2JhbDsgLy8gLT4gdHJ1ZVxyXG4gKi9cclxuICAgIHNlbGYuZ2xvYmFsaXplID0gZnVuY3Rpb24gKHJlZ2V4KSB7XHJcbiAgICAgICAgcmV0dXJuIGNvcHkocmVnZXgsIFwiZ1wiKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogSW5zdGFsbHMgb3B0aW9uYWwgZmVhdHVyZXMgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpZWQgb3B0aW9ucy5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBvcHRpb25zIE9wdGlvbnMgb2JqZWN0IG9yIHN0cmluZy5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gV2l0aCBhbiBvcHRpb25zIG9iamVjdFxyXG4gKiBYUmVnRXhwLmluc3RhbGwoe1xyXG4gKiAgIC8vIE92ZXJyaWRlcyBuYXRpdmUgcmVnZXggbWV0aG9kcyB3aXRoIGZpeGVkL2V4dGVuZGVkIHZlcnNpb25zIHRoYXQgc3VwcG9ydCBuYW1lZFxyXG4gKiAgIC8vIGJhY2tyZWZlcmVuY2VzIGFuZCBmaXggbnVtZXJvdXMgY3Jvc3MtYnJvd3NlciBidWdzXHJcbiAqICAgbmF0aXZlczogdHJ1ZSxcclxuICpcclxuICogICAvLyBFbmFibGVzIGV4dGVuc2liaWxpdHkgb2YgWFJlZ0V4cCBzeW50YXggYW5kIGZsYWdzXHJcbiAqICAgZXh0ZW5zaWJpbGl0eTogdHJ1ZVxyXG4gKiB9KTtcclxuICpcclxuICogLy8gV2l0aCBhbiBvcHRpb25zIHN0cmluZ1xyXG4gKiBYUmVnRXhwLmluc3RhbGwoJ25hdGl2ZXMgZXh0ZW5zaWJpbGl0eScpO1xyXG4gKlxyXG4gKiAvLyBVc2luZyBhIHNob3J0Y3V0IHRvIGluc3RhbGwgYWxsIG9wdGlvbmFsIGZlYXR1cmVzXHJcbiAqIFhSZWdFeHAuaW5zdGFsbCgnYWxsJyk7XHJcbiAqL1xyXG4gICAgc2VsZi5pbnN0YWxsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuICAgICAgICBvcHRpb25zID0gcHJlcGFyZU9wdGlvbnMob3B0aW9ucyk7XHJcbiAgICAgICAgaWYgKCFmZWF0dXJlcy5uYXRpdmVzICYmIG9wdGlvbnMubmF0aXZlcykge1xyXG4gICAgICAgICAgICBzZXROYXRpdmVzKHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWZlYXR1cmVzLmV4dGVuc2liaWxpdHkgJiYgb3B0aW9ucy5leHRlbnNpYmlsaXR5KSB7XHJcbiAgICAgICAgICAgIHNldEV4dGVuc2liaWxpdHkodHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3Mgd2hldGhlciBhbiBpbmRpdmlkdWFsIG9wdGlvbmFsIGZlYXR1cmUgaXMgaW5zdGFsbGVkLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZmVhdHVyZSBOYW1lIG9mIHRoZSBmZWF0dXJlIHRvIGNoZWNrLiBPbmUgb2Y6XHJcbiAqICAgPGxpPmBuYXRpdmVzYFxyXG4gKiAgIDxsaT5gZXh0ZW5zaWJpbGl0eWBcclxuICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgdGhlIGZlYXR1cmUgaXMgaW5zdGFsbGVkLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwLmlzSW5zdGFsbGVkKCduYXRpdmVzJyk7XHJcbiAqL1xyXG4gICAgc2VsZi5pc0luc3RhbGxlZCA9IGZ1bmN0aW9uIChmZWF0dXJlKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKGZlYXR1cmVzW2ZlYXR1cmVdKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogUmV0dXJucyBgdHJ1ZWAgaWYgYW4gb2JqZWN0IGlzIGEgcmVnZXg7IGBmYWxzZWAgaWYgaXQgaXNuJ3QuIFRoaXMgd29ya3MgY29ycmVjdGx5IGZvciByZWdleGVzXHJcbiAqIGNyZWF0ZWQgaW4gYW5vdGhlciBmcmFtZSwgd2hlbiBgaW5zdGFuY2VvZmAgYW5kIGBjb25zdHJ1Y3RvcmAgY2hlY2tzIHdvdWxkIGZhaWwuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgT2JqZWN0IHRvIGNoZWNrLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciB0aGUgb2JqZWN0IGlzIGEgYFJlZ0V4cGAgb2JqZWN0LlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwLmlzUmVnRXhwKCdzdHJpbmcnKTsgLy8gLT4gZmFsc2VcclxuICogWFJlZ0V4cC5pc1JlZ0V4cCgvcmVnZXgvaSk7IC8vIC0+IHRydWVcclxuICogWFJlZ0V4cC5pc1JlZ0V4cChSZWdFeHAoJ14nLCAnbScpKTsgLy8gLT4gdHJ1ZVxyXG4gKiBYUmVnRXhwLmlzUmVnRXhwKFhSZWdFeHAoJyg/cykuJykpOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgc2VsZi5pc1JlZ0V4cCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiBpc1R5cGUodmFsdWUsIFwicmVnZXhwXCIpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBSZXRyaWV2ZXMgdGhlIG1hdGNoZXMgZnJvbSBzZWFyY2hpbmcgYSBzdHJpbmcgdXNpbmcgYSBjaGFpbiBvZiByZWdleGVzIHRoYXQgc3VjY2Vzc2l2ZWx5IHNlYXJjaFxyXG4gKiB3aXRoaW4gcHJldmlvdXMgbWF0Y2hlcy4gVGhlIHByb3ZpZGVkIGBjaGFpbmAgYXJyYXkgY2FuIGNvbnRhaW4gcmVnZXhlcyBhbmQgb2JqZWN0cyB3aXRoIGByZWdleGBcclxuICogYW5kIGBiYWNrcmVmYCBwcm9wZXJ0aWVzLiBXaGVuIGEgYmFja3JlZmVyZW5jZSBpcyBzcGVjaWZpZWQsIHRoZSBuYW1lZCBvciBudW1iZXJlZCBiYWNrcmVmZXJlbmNlXHJcbiAqIGlzIHBhc3NlZCBmb3J3YXJkIHRvIHRoZSBuZXh0IHJlZ2V4IG9yIHJldHVybmVkLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzZWFyY2guXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGNoYWluIFJlZ2V4ZXMgdGhhdCBlYWNoIHNlYXJjaCBmb3IgbWF0Y2hlcyB3aXRoaW4gcHJlY2VkaW5nIHJlc3VsdHMuXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gTWF0Y2hlcyBieSB0aGUgbGFzdCByZWdleCBpbiB0aGUgY2hhaW4sIG9yIGFuIGVtcHR5IGFycmF5LlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBCYXNpYyB1c2FnZTsgbWF0Y2hlcyBudW1iZXJzIHdpdGhpbiA8Yj4gdGFnc1xyXG4gKiBYUmVnRXhwLm1hdGNoQ2hhaW4oJzEgPGI+MjwvYj4gMyA8Yj40IGEgNTY8L2I+JywgW1xyXG4gKiAgIFhSZWdFeHAoJyg/aXMpPGI+Lio/PC9iPicpLFxyXG4gKiAgIC9cXGQrL1xyXG4gKiBdKTtcclxuICogLy8gLT4gWycyJywgJzQnLCAnNTYnXVxyXG4gKlxyXG4gKiAvLyBQYXNzaW5nIGZvcndhcmQgYW5kIHJldHVybmluZyBzcGVjaWZpYyBiYWNrcmVmZXJlbmNlc1xyXG4gKiBodG1sID0gJzxhIGhyZWY9XCJodHRwOi8veHJlZ2V4cC5jb20vYXBpL1wiPlhSZWdFeHA8L2E+XFxcclxuICogICAgICAgICA8YSBocmVmPVwiaHR0cDovL3d3dy5nb29nbGUuY29tL1wiPkdvb2dsZTwvYT4nO1xyXG4gKiBYUmVnRXhwLm1hdGNoQ2hhaW4oaHRtbCwgW1xyXG4gKiAgIHtyZWdleDogLzxhIGhyZWY9XCIoW15cIl0rKVwiPi9pLCBiYWNrcmVmOiAxfSxcclxuICogICB7cmVnZXg6IFhSZWdFeHAoJyg/aSleaHR0cHM/Oi8vKD88ZG9tYWluPlteLz8jXSspJyksIGJhY2tyZWY6ICdkb21haW4nfVxyXG4gKiBdKTtcclxuICogLy8gLT4gWyd4cmVnZXhwLmNvbScsICd3d3cuZ29vZ2xlLmNvbSddXHJcbiAqL1xyXG4gICAgc2VsZi5tYXRjaENoYWluID0gZnVuY3Rpb24gKHN0ciwgY2hhaW4pIHtcclxuICAgICAgICByZXR1cm4gKGZ1bmN0aW9uIHJlY3Vyc2VDaGFpbih2YWx1ZXMsIGxldmVsKSB7XHJcbiAgICAgICAgICAgIHZhciBpdGVtID0gY2hhaW5bbGV2ZWxdLnJlZ2V4ID8gY2hhaW5bbGV2ZWxdIDoge3JlZ2V4OiBjaGFpbltsZXZlbF19LFxyXG4gICAgICAgICAgICAgICAgbWF0Y2hlcyA9IFtdLFxyXG4gICAgICAgICAgICAgICAgYWRkTWF0Y2ggPSBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goaXRlbS5iYWNrcmVmID8gKG1hdGNoW2l0ZW0uYmFja3JlZl0gfHwgXCJcIikgOiBtYXRjaFswXSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgaTtcclxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5mb3JFYWNoKHZhbHVlc1tpXSwgaXRlbS5yZWdleCwgYWRkTWF0Y2gpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiAoKGxldmVsID09PSBjaGFpbi5sZW5ndGggLSAxKSB8fCAhbWF0Y2hlcy5sZW5ndGgpID9cclxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzIDpcclxuICAgICAgICAgICAgICAgICAgICByZWN1cnNlQ2hhaW4obWF0Y2hlcywgbGV2ZWwgKyAxKTtcclxuICAgICAgICB9KFtzdHJdLCAwKSk7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBuZXcgc3RyaW5nIHdpdGggb25lIG9yIGFsbCBtYXRjaGVzIG9mIGEgcGF0dGVybiByZXBsYWNlZC4gVGhlIHBhdHRlcm4gY2FuIGJlIGEgc3RyaW5nXHJcbiAqIG9yIHJlZ2V4LCBhbmQgdGhlIHJlcGxhY2VtZW50IGNhbiBiZSBhIHN0cmluZyBvciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBmb3IgZWFjaCBtYXRjaC4gVG9cclxuICogcGVyZm9ybSBhIGdsb2JhbCBzZWFyY2ggYW5kIHJlcGxhY2UsIHVzZSB0aGUgb3B0aW9uYWwgYHNjb3BlYCBhcmd1bWVudCBvciBpbmNsdWRlIGZsYWcgYGdgIGlmXHJcbiAqIHVzaW5nIGEgcmVnZXguIFJlcGxhY2VtZW50IHN0cmluZ3MgY2FuIHVzZSBgJHtufWAgZm9yIG5hbWVkIGFuZCBudW1iZXJlZCBiYWNrcmVmZXJlbmNlcy5cclxuICogUmVwbGFjZW1lbnQgZnVuY3Rpb25zIGNhbiB1c2UgbmFtZWQgYmFja3JlZmVyZW5jZXMgdmlhIGBhcmd1bWVudHNbMF0ubmFtZWAuIEFsc28gZml4ZXMgYnJvd3NlclxyXG4gKiBidWdzIGNvbXBhcmVkIHRvIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUucmVwbGFjZWAgYW5kIGNhbiBiZSB1c2VkIHJlbGlhYmx5IGNyb3NzLWJyb3dzZXIuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZWFyY2ggU2VhcmNoIHBhdHRlcm4gdG8gYmUgcmVwbGFjZWQuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfEZ1bmN0aW9ufSByZXBsYWNlbWVudCBSZXBsYWNlbWVudCBzdHJpbmcgb3IgYSBmdW5jdGlvbiBpbnZva2VkIHRvIGNyZWF0ZSBpdC5cclxuICogICBSZXBsYWNlbWVudCBzdHJpbmdzIGNhbiBpbmNsdWRlIHNwZWNpYWwgcmVwbGFjZW1lbnQgc3ludGF4OlxyXG4gKiAgICAgPGxpPiQkIC0gSW5zZXJ0cyBhIGxpdGVyYWwgJyQnLlxyXG4gKiAgICAgPGxpPiQmLCAkMCAtIEluc2VydHMgdGhlIG1hdGNoZWQgc3Vic3RyaW5nLlxyXG4gKiAgICAgPGxpPiRgIC0gSW5zZXJ0cyB0aGUgc3RyaW5nIHRoYXQgcHJlY2VkZXMgdGhlIG1hdGNoZWQgc3Vic3RyaW5nIChsZWZ0IGNvbnRleHQpLlxyXG4gKiAgICAgPGxpPiQnIC0gSW5zZXJ0cyB0aGUgc3RyaW5nIHRoYXQgZm9sbG93cyB0aGUgbWF0Y2hlZCBzdWJzdHJpbmcgKHJpZ2h0IGNvbnRleHQpLlxyXG4gKiAgICAgPGxpPiRuLCAkbm4gLSBXaGVyZSBuL25uIGFyZSBkaWdpdHMgcmVmZXJlbmNpbmcgYW4gZXhpc3RlbnQgY2FwdHVyaW5nIGdyb3VwLCBpbnNlcnRzXHJcbiAqICAgICAgIGJhY2tyZWZlcmVuY2Ugbi9ubi5cclxuICogICAgIDxsaT4ke259IC0gV2hlcmUgbiBpcyBhIG5hbWUgb3IgYW55IG51bWJlciBvZiBkaWdpdHMgdGhhdCByZWZlcmVuY2UgYW4gZXhpc3RlbnQgY2FwdHVyaW5nXHJcbiAqICAgICAgIGdyb3VwLCBpbnNlcnRzIGJhY2tyZWZlcmVuY2Ugbi5cclxuICogICBSZXBsYWNlbWVudCBmdW5jdGlvbnMgYXJlIGludm9rZWQgd2l0aCB0aHJlZSBvciBtb3JlIGFyZ3VtZW50czpcclxuICogICAgIDxsaT5UaGUgbWF0Y2hlZCBzdWJzdHJpbmcgKGNvcnJlc3BvbmRzIHRvICQmIGFib3ZlKS4gTmFtZWQgYmFja3JlZmVyZW5jZXMgYXJlIGFjY2Vzc2libGUgYXNcclxuICogICAgICAgcHJvcGVydGllcyBvZiB0aGlzIGZpcnN0IGFyZ3VtZW50LlxyXG4gKiAgICAgPGxpPjAuLm4gYXJndW1lbnRzLCBvbmUgZm9yIGVhY2ggYmFja3JlZmVyZW5jZSAoY29ycmVzcG9uZGluZyB0byAkMSwgJDIsIGV0Yy4gYWJvdmUpLlxyXG4gKiAgICAgPGxpPlRoZSB6ZXJvLWJhc2VkIGluZGV4IG9mIHRoZSBtYXRjaCB3aXRoaW4gdGhlIHRvdGFsIHNlYXJjaCBzdHJpbmcuXHJcbiAqICAgICA8bGk+VGhlIHRvdGFsIHN0cmluZyBiZWluZyBzZWFyY2hlZC5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtzY29wZT0nb25lJ10gVXNlICdvbmUnIHRvIHJlcGxhY2UgdGhlIGZpcnN0IG1hdGNoIG9ubHksIG9yICdhbGwnLiBJZiBub3RcclxuICogICBleHBsaWNpdGx5IHNwZWNpZmllZCBhbmQgdXNpbmcgYSByZWdleCB3aXRoIGZsYWcgYGdgLCBgc2NvcGVgIGlzICdhbGwnLlxyXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBOZXcgc3RyaW5nIHdpdGggb25lIG9yIGFsbCBtYXRjaGVzIHJlcGxhY2VkLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBSZWdleCBzZWFyY2gsIHVzaW5nIG5hbWVkIGJhY2tyZWZlcmVuY2VzIGluIHJlcGxhY2VtZW50IHN0cmluZ1xyXG4gKiB2YXIgbmFtZSA9IFhSZWdFeHAoJyg/PGZpcnN0PlxcXFx3KykgKD88bGFzdD5cXFxcdyspJyk7XHJcbiAqIFhSZWdFeHAucmVwbGFjZSgnSm9obiBTbWl0aCcsIG5hbWUsICcke2xhc3R9LCAke2ZpcnN0fScpO1xyXG4gKiAvLyAtPiAnU21pdGgsIEpvaG4nXHJcbiAqXHJcbiAqIC8vIFJlZ2V4IHNlYXJjaCwgdXNpbmcgbmFtZWQgYmFja3JlZmVyZW5jZXMgaW4gcmVwbGFjZW1lbnQgZnVuY3Rpb25cclxuICogWFJlZ0V4cC5yZXBsYWNlKCdKb2huIFNtaXRoJywgbmFtZSwgZnVuY3Rpb24gKG1hdGNoKSB7XHJcbiAqICAgcmV0dXJuIG1hdGNoLmxhc3QgKyAnLCAnICsgbWF0Y2guZmlyc3Q7XHJcbiAqIH0pO1xyXG4gKiAvLyAtPiAnU21pdGgsIEpvaG4nXHJcbiAqXHJcbiAqIC8vIEdsb2JhbCBzdHJpbmcgc2VhcmNoL3JlcGxhY2VtZW50XHJcbiAqIFhSZWdFeHAucmVwbGFjZSgnUmVnRXhwIGJ1aWxkcyBSZWdFeHBzJywgJ1JlZ0V4cCcsICdYUmVnRXhwJywgJ2FsbCcpO1xyXG4gKiAvLyAtPiAnWFJlZ0V4cCBidWlsZHMgWFJlZ0V4cHMnXHJcbiAqL1xyXG4gICAgc2VsZi5yZXBsYWNlID0gZnVuY3Rpb24gKHN0ciwgc2VhcmNoLCByZXBsYWNlbWVudCwgc2NvcGUpIHtcclxuICAgICAgICB2YXIgaXNSZWdleCA9IHNlbGYuaXNSZWdFeHAoc2VhcmNoKSxcclxuICAgICAgICAgICAgc2VhcmNoMiA9IHNlYXJjaCxcclxuICAgICAgICAgICAgcmVzdWx0O1xyXG4gICAgICAgIGlmIChpc1JlZ2V4KSB7XHJcbiAgICAgICAgICAgIGlmIChzY29wZSA9PT0gdW5kZWYgJiYgc2VhcmNoLmdsb2JhbCkge1xyXG4gICAgICAgICAgICAgICAgc2NvcGUgPSBcImFsbFwiOyAvLyBGb2xsb3cgZmxhZyBnIHdoZW4gYHNjb3BlYCBpc24ndCBleHBsaWNpdFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBzaW5jZSBhIGNvcHkgaXMgdXNlZCwgYHNlYXJjaGAncyBgbGFzdEluZGV4YCBpc24ndCB1cGRhdGVkICpkdXJpbmcqIHJlcGxhY2VtZW50IGl0ZXJhdGlvbnNcclxuICAgICAgICAgICAgc2VhcmNoMiA9IGNvcHkoc2VhcmNoLCBzY29wZSA9PT0gXCJhbGxcIiA/IFwiZ1wiIDogXCJcIiwgc2NvcGUgPT09IFwiYWxsXCIgPyBcIlwiIDogXCJnXCIpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoc2NvcGUgPT09IFwiYWxsXCIpIHtcclxuICAgICAgICAgICAgc2VhcmNoMiA9IG5ldyBSZWdFeHAoc2VsZi5lc2NhcGUoU3RyaW5nKHNlYXJjaCkpLCBcImdcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlc3VsdCA9IGZpeGVkLnJlcGxhY2UuY2FsbChTdHJpbmcoc3RyKSwgc2VhcmNoMiwgcmVwbGFjZW1lbnQpOyAvLyBGaXhlZCBgcmVwbGFjZWAgcmVxdWlyZWQgZm9yIG5hbWVkIGJhY2tyZWZlcmVuY2VzLCBldGMuXHJcbiAgICAgICAgaWYgKGlzUmVnZXggJiYgc2VhcmNoLmdsb2JhbCkge1xyXG4gICAgICAgICAgICBzZWFyY2gubGFzdEluZGV4ID0gMDsgLy8gRml4ZXMgSUUsIFNhZmFyaSBidWcgKGxhc3QgdGVzdGVkIElFIDksIFNhZmFyaSA1LjEpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFNwbGl0cyBhIHN0cmluZyBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MgdXNpbmcgYSByZWdleCBvciBzdHJpbmcgc2VwYXJhdG9yLiBNYXRjaGVzIG9mIHRoZVxyXG4gKiBzZXBhcmF0b3IgYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGUgcmVzdWx0IGFycmF5LiBIb3dldmVyLCBpZiBgc2VwYXJhdG9yYCBpcyBhIHJlZ2V4IHRoYXQgY29udGFpbnNcclxuICogY2FwdHVyaW5nIGdyb3VwcywgYmFja3JlZmVyZW5jZXMgYXJlIHNwbGljZWQgaW50byB0aGUgcmVzdWx0IGVhY2ggdGltZSBgc2VwYXJhdG9yYCBpcyBtYXRjaGVkLlxyXG4gKiBGaXhlcyBicm93c2VyIGJ1Z3MgY29tcGFyZWQgdG8gdGhlIG5hdGl2ZSBgU3RyaW5nLnByb3RvdHlwZS5zcGxpdGAgYW5kIGNhbiBiZSB1c2VkIHJlbGlhYmx5XHJcbiAqIGNyb3NzLWJyb3dzZXIuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNwbGl0LlxyXG4gKiBAcGFyYW0ge1JlZ0V4cHxTdHJpbmd9IHNlcGFyYXRvciBSZWdleCBvciBzdHJpbmcgdG8gdXNlIGZvciBzZXBhcmF0aW5nIHRoZSBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbbGltaXRdIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRvIGluY2x1ZGUgaW4gdGhlIHJlc3VsdCBhcnJheS5cclxuICogQHJldHVybnMge0FycmF5fSBBcnJheSBvZiBzdWJzdHJpbmdzLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBCYXNpYyB1c2VcclxuICogWFJlZ0V4cC5zcGxpdCgnYSBiIGMnLCAnICcpO1xyXG4gKiAvLyAtPiBbJ2EnLCAnYicsICdjJ11cclxuICpcclxuICogLy8gV2l0aCBsaW1pdFxyXG4gKiBYUmVnRXhwLnNwbGl0KCdhIGIgYycsICcgJywgMik7XHJcbiAqIC8vIC0+IFsnYScsICdiJ11cclxuICpcclxuICogLy8gQmFja3JlZmVyZW5jZXMgaW4gcmVzdWx0IGFycmF5XHJcbiAqIFhSZWdFeHAuc3BsaXQoJy4ud29yZDEuLicsIC8oW2Etel0rKShcXGQrKS9pKTtcclxuICogLy8gLT4gWycuLicsICd3b3JkJywgJzEnLCAnLi4nXVxyXG4gKi9cclxuICAgIHNlbGYuc3BsaXQgPSBmdW5jdGlvbiAoc3RyLCBzZXBhcmF0b3IsIGxpbWl0KSB7XHJcbiAgICAgICAgcmV0dXJuIGZpeGVkLnNwbGl0LmNhbGwoc3RyLCBzZXBhcmF0b3IsIGxpbWl0KTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogRXhlY3V0ZXMgYSByZWdleCBzZWFyY2ggaW4gYSBzcGVjaWZpZWQgc3RyaW5nLiBSZXR1cm5zIGB0cnVlYCBvciBgZmFsc2VgLiBPcHRpb25hbCBgcG9zYCBhbmRcclxuICogYHN0aWNreWAgYXJndW1lbnRzIHNwZWNpZnkgdGhlIHNlYXJjaCBzdGFydCBwb3NpdGlvbiwgYW5kIHdoZXRoZXIgdGhlIG1hdGNoIG11c3Qgc3RhcnQgYXQgdGhlXHJcbiAqIHNwZWNpZmllZCBwb3NpdGlvbiBvbmx5LiBUaGUgYGxhc3RJbmRleGAgcHJvcGVydHkgb2YgdGhlIHByb3ZpZGVkIHJlZ2V4IGlzIG5vdCB1c2VkLCBidXQgaXNcclxuICogdXBkYXRlZCBmb3IgY29tcGF0aWJpbGl0eS4gQWxzbyBmaXhlcyBicm93c2VyIGJ1Z3MgY29tcGFyZWQgdG8gdGhlIG5hdGl2ZVxyXG4gKiBgUmVnRXhwLnByb3RvdHlwZS50ZXN0YCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHkgY3Jvc3MtYnJvd3Nlci5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gc2VhcmNoIHdpdGguXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zPTBdIFplcm8tYmFzZWQgaW5kZXggYXQgd2hpY2ggdG8gc3RhcnQgdGhlIHNlYXJjaC5cclxuICogQHBhcmFtIHtCb29sZWFufFN0cmluZ30gW3N0aWNreT1mYWxzZV0gV2hldGhlciB0aGUgbWF0Y2ggbXVzdCBzdGFydCBhdCB0aGUgc3BlY2lmaWVkIHBvc2l0aW9uXHJcbiAqICAgb25seS4gVGhlIHN0cmluZyBgJ3N0aWNreSdgIGlzIGFjY2VwdGVkIGFzIGFuIGFsdGVybmF0aXZlIHRvIGB0cnVlYC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHJlZ2V4IG1hdGNoZWQgdGhlIHByb3ZpZGVkIHZhbHVlLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBCYXNpYyB1c2VcclxuICogWFJlZ0V4cC50ZXN0KCdhYmMnLCAvYy8pOyAvLyAtPiB0cnVlXHJcbiAqXHJcbiAqIC8vIFdpdGggcG9zIGFuZCBzdGlja3lcclxuICogWFJlZ0V4cC50ZXN0KCdhYmMnLCAvYy8sIDAsICdzdGlja3knKTsgLy8gLT4gZmFsc2VcclxuICovXHJcbiAgICBzZWxmLnRlc3QgPSBmdW5jdGlvbiAoc3RyLCByZWdleCwgcG9zLCBzdGlja3kpIHtcclxuICAgICAgICAvLyBEbyB0aGlzIHRoZSBlYXN5IHdheSA6LSlcclxuICAgICAgICByZXR1cm4gISFzZWxmLmV4ZWMoc3RyLCByZWdleCwgcG9zLCBzdGlja3kpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBVbmluc3RhbGxzIG9wdGlvbmFsIGZlYXR1cmVzIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWVkIG9wdGlvbnMuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gb3B0aW9ucyBPcHRpb25zIG9iamVjdCBvciBzdHJpbmcuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIFdpdGggYW4gb3B0aW9ucyBvYmplY3RcclxuICogWFJlZ0V4cC51bmluc3RhbGwoe1xyXG4gKiAgIC8vIFJlc3RvcmVzIG5hdGl2ZSByZWdleCBtZXRob2RzXHJcbiAqICAgbmF0aXZlczogdHJ1ZSxcclxuICpcclxuICogICAvLyBEaXNhYmxlcyBhZGRpdGlvbmFsIHN5bnRheCBhbmQgZmxhZyBleHRlbnNpb25zXHJcbiAqICAgZXh0ZW5zaWJpbGl0eTogdHJ1ZVxyXG4gKiB9KTtcclxuICpcclxuICogLy8gV2l0aCBhbiBvcHRpb25zIHN0cmluZ1xyXG4gKiBYUmVnRXhwLnVuaW5zdGFsbCgnbmF0aXZlcyBleHRlbnNpYmlsaXR5Jyk7XHJcbiAqXHJcbiAqIC8vIFVzaW5nIGEgc2hvcnRjdXQgdG8gdW5pbnN0YWxsIGFsbCBvcHRpb25hbCBmZWF0dXJlc1xyXG4gKiBYUmVnRXhwLnVuaW5zdGFsbCgnYWxsJyk7XHJcbiAqL1xyXG4gICAgc2VsZi51bmluc3RhbGwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gICAgICAgIG9wdGlvbnMgPSBwcmVwYXJlT3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICBpZiAoZmVhdHVyZXMubmF0aXZlcyAmJiBvcHRpb25zLm5hdGl2ZXMpIHtcclxuICAgICAgICAgICAgc2V0TmF0aXZlcyhmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmZWF0dXJlcy5leHRlbnNpYmlsaXR5ICYmIG9wdGlvbnMuZXh0ZW5zaWJpbGl0eSkge1xyXG4gICAgICAgICAgICBzZXRFeHRlbnNpYmlsaXR5KGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYW4gWFJlZ0V4cCBvYmplY3QgdGhhdCBpcyB0aGUgdW5pb24gb2YgdGhlIGdpdmVuIHBhdHRlcm5zLiBQYXR0ZXJucyBjYW4gYmUgcHJvdmlkZWQgYXNcclxuICogcmVnZXggb2JqZWN0cyBvciBzdHJpbmdzLiBNZXRhY2hhcmFjdGVycyBhcmUgZXNjYXBlZCBpbiBwYXR0ZXJucyBwcm92aWRlZCBhcyBzdHJpbmdzLlxyXG4gKiBCYWNrcmVmZXJlbmNlcyBpbiBwcm92aWRlZCByZWdleCBvYmplY3RzIGFyZSBhdXRvbWF0aWNhbGx5IHJlbnVtYmVyZWQgdG8gd29yayBjb3JyZWN0bHkuIE5hdGl2ZVxyXG4gKiBmbGFncyB1c2VkIGJ5IHByb3ZpZGVkIHJlZ2V4ZXMgYXJlIGlnbm9yZWQgaW4gZmF2b3Igb2YgdGhlIGBmbGFnc2AgYXJndW1lbnQuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHBhdHRlcm5zIFJlZ2V4ZXMgYW5kIHN0cmluZ3MgdG8gY29tYmluZS5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtmbGFnc10gQW55IGNvbWJpbmF0aW9uIG9mIFhSZWdFeHAgZmxhZ3MuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IFVuaW9uIG9mIHRoZSBwcm92aWRlZCByZWdleGVzIGFuZCBzdHJpbmdzLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwLnVuaW9uKFsnYStiKmMnLCAvKGRvZ3MpXFwxLywgLyhjYXRzKVxcMS9dLCAnaScpO1xyXG4gKiAvLyAtPiAvYVxcK2JcXCpjfChkb2dzKVxcMXwoY2F0cylcXDIvaVxyXG4gKlxyXG4gKiBYUmVnRXhwLnVuaW9uKFtYUmVnRXhwKCcoPzxwZXQ+ZG9ncylcXFxcazxwZXQ+JyksIFhSZWdFeHAoJyg/PHBldD5jYXRzKVxcXFxrPHBldD4nKV0pO1xyXG4gKiAvLyAtPiBYUmVnRXhwKCcoPzxwZXQ+ZG9ncylcXFxcazxwZXQ+fCg/PHBldD5jYXRzKVxcXFxrPHBldD4nKVxyXG4gKi9cclxuICAgIHNlbGYudW5pb24gPSBmdW5jdGlvbiAocGF0dGVybnMsIGZsYWdzKSB7XHJcbiAgICAgICAgdmFyIHBhcnRzID0gLyhcXCgpKD8hXFw/KXxcXFxcKFsxLTldXFxkKil8XFxcXFtcXHNcXFNdfFxcWyg/OlteXFxcXFxcXV18XFxcXFtcXHNcXFNdKSpdL2csXHJcbiAgICAgICAgICAgIG51bUNhcHR1cmVzID0gMCxcclxuICAgICAgICAgICAgbnVtUHJpb3JDYXB0dXJlcyxcclxuICAgICAgICAgICAgY2FwdHVyZU5hbWVzLFxyXG4gICAgICAgICAgICByZXdyaXRlID0gZnVuY3Rpb24gKG1hdGNoLCBwYXJlbiwgYmFja3JlZikge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBjYXB0dXJlTmFtZXNbbnVtQ2FwdHVyZXMgLSBudW1QcmlvckNhcHR1cmVzXTtcclxuICAgICAgICAgICAgICAgIGlmIChwYXJlbikgeyAvLyBDYXB0dXJpbmcgZ3JvdXBcclxuICAgICAgICAgICAgICAgICAgICArK251bUNhcHR1cmVzO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lKSB7IC8vIElmIHRoZSBjdXJyZW50IGNhcHR1cmUgaGFzIGEgbmFtZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIoPzxcIiArIG5hbWUgKyBcIj5cIjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGJhY2tyZWYpIHsgLy8gQmFja3JlZmVyZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIlxcXFxcIiArICgrYmFja3JlZiArIG51bVByaW9yQ2FwdHVyZXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvdXRwdXQgPSBbXSxcclxuICAgICAgICAgICAgcGF0dGVybixcclxuICAgICAgICAgICAgaTtcclxuICAgICAgICBpZiAoIShpc1R5cGUocGF0dGVybnMsIFwiYXJyYXlcIikgJiYgcGF0dGVybnMubGVuZ3RoKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicGF0dGVybnMgbXVzdCBiZSBhIG5vbmVtcHR5IGFycmF5XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcGF0dGVybnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm5zW2ldO1xyXG4gICAgICAgICAgICBpZiAoc2VsZi5pc1JlZ0V4cChwYXR0ZXJuKSkge1xyXG4gICAgICAgICAgICAgICAgbnVtUHJpb3JDYXB0dXJlcyA9IG51bUNhcHR1cmVzO1xyXG4gICAgICAgICAgICAgICAgY2FwdHVyZU5hbWVzID0gKHBhdHRlcm4ueHJlZ2V4cCAmJiBwYXR0ZXJuLnhyZWdleHAuY2FwdHVyZU5hbWVzKSB8fCBbXTtcclxuICAgICAgICAgICAgICAgIC8vIFJld3JpdGUgYmFja3JlZmVyZW5jZXMuIFBhc3NpbmcgdG8gWFJlZ0V4cCBkaWVzIG9uIG9jdGFscyBhbmQgZW5zdXJlcyBwYXR0ZXJuc1xyXG4gICAgICAgICAgICAgICAgLy8gYXJlIGluZGVwZW5kZW50bHkgdmFsaWQ7IGhlbHBzIGtlZXAgdGhpcyBzaW1wbGUuIE5hbWVkIGNhcHR1cmVzIGFyZSBwdXQgYmFja1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goc2VsZihwYXR0ZXJuLnNvdXJjZSkuc291cmNlLnJlcGxhY2UocGFydHMsIHJld3JpdGUpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKHNlbGYuZXNjYXBlKHBhdHRlcm4pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc2VsZihvdXRwdXQuam9pbihcInxcIiksIGZsYWdzKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogVGhlIFhSZWdFeHAgdmVyc2lvbiBudW1iZXIuXHJcbiAqIEBzdGF0aWNcclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHR5cGUgU3RyaW5nXHJcbiAqL1xyXG4gICAgc2VsZi52ZXJzaW9uID0gXCIyLjAuMFwiO1xyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgRml4ZWQvZXh0ZW5kZWQgbmF0aXZlIG1ldGhvZHNcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgbmFtZWQgY2FwdHVyZSBzdXBwb3J0ICh3aXRoIGJhY2tyZWZlcmVuY2VzIHJldHVybmVkIGFzIGByZXN1bHQubmFtZWApLCBhbmQgZml4ZXMgYnJvd3NlclxyXG4gKiBidWdzIGluIHRoZSBuYXRpdmUgYFJlZ0V4cC5wcm90b3R5cGUuZXhlY2AuIENhbGxpbmcgYFhSZWdFeHAuaW5zdGFsbCgnbmF0aXZlcycpYCB1c2VzIHRoaXMgdG9cclxuICogb3ZlcnJpZGUgdGhlIG5hdGl2ZSBtZXRob2QuIFVzZSB2aWEgYFhSZWdFeHAuZXhlY2Agd2l0aG91dCBvdmVycmlkaW5nIG5hdGl2ZXMuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHJldHVybnMge0FycmF5fSBNYXRjaCBhcnJheSB3aXRoIG5hbWVkIGJhY2tyZWZlcmVuY2UgcHJvcGVydGllcywgb3IgbnVsbC5cclxuICovXHJcbiAgICBmaXhlZC5leGVjID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIHZhciBtYXRjaCwgbmFtZSwgcjIsIG9yaWdMYXN0SW5kZXgsIGk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmdsb2JhbCkge1xyXG4gICAgICAgICAgICBvcmlnTGFzdEluZGV4ID0gdGhpcy5sYXN0SW5kZXg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG1hdGNoID0gbmF0aXYuZXhlYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBGaXggYnJvd3NlcnMgd2hvc2UgYGV4ZWNgIG1ldGhvZHMgZG9uJ3QgY29uc2lzdGVudGx5IHJldHVybiBgdW5kZWZpbmVkYCBmb3JcclxuICAgICAgICAgICAgLy8gbm9ucGFydGljaXBhdGluZyBjYXB0dXJpbmcgZ3JvdXBzXHJcbiAgICAgICAgICAgIGlmICghY29tcGxpYW50RXhlY05wY2cgJiYgbWF0Y2gubGVuZ3RoID4gMSAmJiBsYXN0SW5kZXhPZihtYXRjaCwgXCJcIikgPiAtMSkge1xyXG4gICAgICAgICAgICAgICAgcjIgPSBuZXcgUmVnRXhwKHRoaXMuc291cmNlLCBuYXRpdi5yZXBsYWNlLmNhbGwoZ2V0TmF0aXZlRmxhZ3ModGhpcyksIFwiZ1wiLCBcIlwiKSk7XHJcbiAgICAgICAgICAgICAgICAvLyBVc2luZyBgc3RyLnNsaWNlKG1hdGNoLmluZGV4KWAgcmF0aGVyIHRoYW4gYG1hdGNoWzBdYCBpbiBjYXNlIGxvb2thaGVhZCBhbGxvd2VkXHJcbiAgICAgICAgICAgICAgICAvLyBtYXRjaGluZyBkdWUgdG8gY2hhcmFjdGVycyBvdXRzaWRlIHRoZSBtYXRjaFxyXG4gICAgICAgICAgICAgICAgbmF0aXYucmVwbGFjZS5jYWxsKFN0cmluZyhzdHIpLnNsaWNlKG1hdGNoLmluZGV4KSwgcjIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDI7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzW2ldID09PSB1bmRlZikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hbaV0gPSB1bmRlZjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIEF0dGFjaCBuYW1lZCBjYXB0dXJlIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgaWYgKHRoaXMueHJlZ2V4cCAmJiB0aGlzLnhyZWdleHAuY2FwdHVyZU5hbWVzKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbWF0Y2gubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lID0gdGhpcy54cmVnZXhwLmNhcHR1cmVOYW1lc1tpIC0gMV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hbbmFtZV0gPSBtYXRjaFtpXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gRml4IGJyb3dzZXJzIHRoYXQgaW5jcmVtZW50IGBsYXN0SW5kZXhgIGFmdGVyIHplcm8tbGVuZ3RoIG1hdGNoZXNcclxuICAgICAgICAgICAgaWYgKHRoaXMuZ2xvYmFsICYmICFtYXRjaFswXS5sZW5ndGggJiYgKHRoaXMubGFzdEluZGV4ID4gbWF0Y2guaW5kZXgpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxhc3RJbmRleCA9IG1hdGNoLmluZGV4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5nbG9iYWwpIHtcclxuICAgICAgICAgICAgdGhpcy5sYXN0SW5kZXggPSBvcmlnTGFzdEluZGV4OyAvLyBGaXhlcyBJRSwgT3BlcmEgYnVnIChsYXN0IHRlc3RlZCBJRSA5LCBPcGVyYSAxMS42KVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbWF0Y2g7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEZpeGVzIGJyb3dzZXIgYnVncyBpbiB0aGUgbmF0aXZlIGBSZWdFeHAucHJvdG90eXBlLnRlc3RgLiBDYWxsaW5nIGBYUmVnRXhwLmluc3RhbGwoJ25hdGl2ZXMnKWBcclxuICogdXNlcyB0aGlzIHRvIG92ZXJyaWRlIHRoZSBuYXRpdmUgbWV0aG9kLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzZWFyY2guXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSByZWdleCBtYXRjaGVkIHRoZSBwcm92aWRlZCB2YWx1ZS5cclxuICovXHJcbiAgICBmaXhlZC50ZXN0ID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIC8vIERvIHRoaXMgdGhlIGVhc3kgd2F5IDotKVxyXG4gICAgICAgIHJldHVybiAhIWZpeGVkLmV4ZWMuY2FsbCh0aGlzLCBzdHIpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIG5hbWVkIGNhcHR1cmUgc3VwcG9ydCAod2l0aCBiYWNrcmVmZXJlbmNlcyByZXR1cm5lZCBhcyBgcmVzdWx0Lm5hbWVgKSwgYW5kIGZpeGVzIGJyb3dzZXJcclxuICogYnVncyBpbiB0aGUgbmF0aXZlIGBTdHJpbmcucHJvdG90eXBlLm1hdGNoYC4gQ2FsbGluZyBgWFJlZ0V4cC5pbnN0YWxsKCduYXRpdmVzJylgIHVzZXMgdGhpcyB0b1xyXG4gKiBvdmVycmlkZSB0aGUgbmF0aXZlIG1ldGhvZC5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4IFJlZ2V4IHRvIHNlYXJjaCB3aXRoLlxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IElmIGByZWdleGAgdXNlcyBmbGFnIGcsIGFuIGFycmF5IG9mIG1hdGNoIHN0cmluZ3Mgb3IgbnVsbC4gV2l0aG91dCBmbGFnIGcsIHRoZVxyXG4gKiAgIHJlc3VsdCBvZiBjYWxsaW5nIGByZWdleC5leGVjKHRoaXMpYC5cclxuICovXHJcbiAgICBmaXhlZC5tYXRjaCA9IGZ1bmN0aW9uIChyZWdleCkge1xyXG4gICAgICAgIGlmICghc2VsZi5pc1JlZ0V4cChyZWdleCkpIHtcclxuICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4KTsgLy8gVXNlIG5hdGl2ZSBgUmVnRXhwYFxyXG4gICAgICAgIH0gZWxzZSBpZiAocmVnZXguZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBuYXRpdi5tYXRjaC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICByZWdleC5sYXN0SW5kZXggPSAwOyAvLyBGaXhlcyBJRSBidWdcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZpeGVkLmV4ZWMuY2FsbChyZWdleCwgdGhpcyk7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgc3VwcG9ydCBmb3IgYCR7bn1gIHRva2VucyBmb3IgbmFtZWQgYW5kIG51bWJlcmVkIGJhY2tyZWZlcmVuY2VzIGluIHJlcGxhY2VtZW50IHRleHQsIGFuZFxyXG4gKiBwcm92aWRlcyBuYW1lZCBiYWNrcmVmZXJlbmNlcyB0byByZXBsYWNlbWVudCBmdW5jdGlvbnMgYXMgYGFyZ3VtZW50c1swXS5uYW1lYC4gQWxzbyBmaXhlc1xyXG4gKiBicm93c2VyIGJ1Z3MgaW4gcmVwbGFjZW1lbnQgdGV4dCBzeW50YXggd2hlbiBwZXJmb3JtaW5nIGEgcmVwbGFjZW1lbnQgdXNpbmcgYSBub25yZWdleCBzZWFyY2hcclxuICogdmFsdWUsIGFuZCB0aGUgdmFsdWUgb2YgYSByZXBsYWNlbWVudCByZWdleCdzIGBsYXN0SW5kZXhgIHByb3BlcnR5IGR1cmluZyByZXBsYWNlbWVudCBpdGVyYXRpb25zXHJcbiAqIGFuZCB1cG9uIGNvbXBsZXRpb24uIE5vdGUgdGhhdCB0aGlzIGRvZXNuJ3Qgc3VwcG9ydCBTcGlkZXJNb25rZXkncyBwcm9wcmlldGFyeSB0aGlyZCAoYGZsYWdzYClcclxuICogYXJndW1lbnQuIENhbGxpbmcgYFhSZWdFeHAuaW5zdGFsbCgnbmF0aXZlcycpYCB1c2VzIHRoaXMgdG8gb3ZlcnJpZGUgdGhlIG5hdGl2ZSBtZXRob2QuIFVzZSB2aWFcclxuICogYFhSZWdFeHAucmVwbGFjZWAgd2l0aG91dCBvdmVycmlkaW5nIG5hdGl2ZXMuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7UmVnRXhwfFN0cmluZ30gc2VhcmNoIFNlYXJjaCBwYXR0ZXJuIHRvIGJlIHJlcGxhY2VkLlxyXG4gKiBAcGFyYW0ge1N0cmluZ3xGdW5jdGlvbn0gcmVwbGFjZW1lbnQgUmVwbGFjZW1lbnQgc3RyaW5nIG9yIGEgZnVuY3Rpb24gaW52b2tlZCB0byBjcmVhdGUgaXQuXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IE5ldyBzdHJpbmcgd2l0aCBvbmUgb3IgYWxsIG1hdGNoZXMgcmVwbGFjZWQuXHJcbiAqL1xyXG4gICAgZml4ZWQucmVwbGFjZSA9IGZ1bmN0aW9uIChzZWFyY2gsIHJlcGxhY2VtZW50KSB7XHJcbiAgICAgICAgdmFyIGlzUmVnZXggPSBzZWxmLmlzUmVnRXhwKHNlYXJjaCksIGNhcHR1cmVOYW1lcywgcmVzdWx0LCBzdHIsIG9yaWdMYXN0SW5kZXg7XHJcbiAgICAgICAgaWYgKGlzUmVnZXgpIHtcclxuICAgICAgICAgICAgaWYgKHNlYXJjaC54cmVnZXhwKSB7XHJcbiAgICAgICAgICAgICAgICBjYXB0dXJlTmFtZXMgPSBzZWFyY2gueHJlZ2V4cC5jYXB0dXJlTmFtZXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFzZWFyY2guZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgICAgICBvcmlnTGFzdEluZGV4ID0gc2VhcmNoLmxhc3RJbmRleDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNlYXJjaCArPSBcIlwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaXNUeXBlKHJlcGxhY2VtZW50LCBcImZ1bmN0aW9uXCIpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IG5hdGl2LnJlcGxhY2UuY2FsbChTdHJpbmcodGhpcyksIHNlYXJjaCwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsIGk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FwdHVyZU5hbWVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hhbmdlIHRoZSBgYXJndW1lbnRzWzBdYCBzdHJpbmcgcHJpbWl0aXZlIHRvIGEgYFN0cmluZ2Agb2JqZWN0IHRoYXQgY2FuIHN0b3JlIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgICAgICAgICBhcmdzWzBdID0gbmV3IFN0cmluZyhhcmdzWzBdKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSBuYW1lZCBiYWNrcmVmZXJlbmNlcyBvbiB0aGUgZmlyc3QgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2FwdHVyZU5hbWVzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYXB0dXJlTmFtZXNbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3NbMF1bY2FwdHVyZU5hbWVzW2ldXSA9IGFyZ3NbaSArIDFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGBsYXN0SW5kZXhgIGJlZm9yZSBjYWxsaW5nIGByZXBsYWNlbWVudGAuXHJcbiAgICAgICAgICAgICAgICAvLyBGaXhlcyBJRSwgQ2hyb21lLCBGaXJlZm94LCBTYWZhcmkgYnVnIChsYXN0IHRlc3RlZCBJRSA5LCBDaHJvbWUgMTcsIEZpcmVmb3ggMTEsIFNhZmFyaSA1LjEpXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNSZWdleCAmJiBzZWFyY2guZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoLmxhc3RJbmRleCA9IGFyZ3NbYXJncy5sZW5ndGggLSAyXSArIGFyZ3NbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcGxhY2VtZW50LmFwcGx5KG51bGwsIGFyZ3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzdHIgPSBTdHJpbmcodGhpcyk7IC8vIEVuc3VyZSBgYXJnc1thcmdzLmxlbmd0aCAtIDFdYCB3aWxsIGJlIGEgc3RyaW5nIHdoZW4gZ2l2ZW4gbm9uc3RyaW5nIGB0aGlzYFxyXG4gICAgICAgICAgICByZXN1bHQgPSBuYXRpdi5yZXBsYWNlLmNhbGwoc3RyLCBzZWFyY2gsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzOyAvLyBLZWVwIHRoaXMgZnVuY3Rpb24ncyBgYXJndW1lbnRzYCBhdmFpbGFibGUgdGhyb3VnaCBjbG9zdXJlXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmF0aXYucmVwbGFjZS5jYWxsKFN0cmluZyhyZXBsYWNlbWVudCksIHJlcGxhY2VtZW50VG9rZW4sIGZ1bmN0aW9uICgkMCwgJDEsICQyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG47XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTmFtZWQgb3IgbnVtYmVyZWQgYmFja3JlZmVyZW5jZSB3aXRoIGN1cmx5IGJyYWNrZXRzXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCQxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIFhSZWdFeHAgYmVoYXZpb3IgZm9yIGAke259YDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICogMS4gQmFja3JlZmVyZW5jZSB0byBudW1iZXJlZCBjYXB0dXJlLCB3aGVyZSBgbmAgaXMgMSsgZGlnaXRzLiBgMGAsIGAwMGAsIGV0Yy4gaXMgdGhlIGVudGlyZSBtYXRjaC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICogMi4gQmFja3JlZmVyZW5jZSB0byBuYW1lZCBjYXB0dXJlIGBuYCwgaWYgaXQgZXhpc3RzIGFuZCBpcyBub3QgYSBudW1iZXIgb3ZlcnJpZGRlbiBieSBudW1iZXJlZCBjYXB0dXJlLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiAzLiBPdGhlcndpc2UsIGl0J3MgYW4gZXJyb3IuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuID0gKyQxOyAvLyBUeXBlLWNvbnZlcnQ7IGRyb3AgbGVhZGluZyB6ZXJvc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobiA8PSBhcmdzLmxlbmd0aCAtIDMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhcmdzW25dIHx8IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgbiA9IGNhcHR1cmVOYW1lcyA/IGxhc3RJbmRleE9mKGNhcHR1cmVOYW1lcywgJDEpIDogLTE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuIDwgMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiYmFja3JlZmVyZW5jZSB0byB1bmRlZmluZWQgZ3JvdXAgXCIgKyAkMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3NbbiArIDFdIHx8IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEVsc2UsIHNwZWNpYWwgdmFyaWFibGUgb3IgbnVtYmVyZWQgYmFja3JlZmVyZW5jZSAod2l0aG91dCBjdXJseSBicmFja2V0cylcclxuICAgICAgICAgICAgICAgICAgICBpZiAoJDIgPT09IFwiJFwiKSByZXR1cm4gXCIkXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCQyID09PSBcIiZcIiB8fCArJDIgPT09IDApIHJldHVybiBhcmdzWzBdOyAvLyAkJiwgJDAgKG5vdCBmb2xsb3dlZCBieSAxLTkpLCAkMDBcclxuICAgICAgICAgICAgICAgICAgICBpZiAoJDIgPT09IFwiYFwiKSByZXR1cm4gYXJnc1thcmdzLmxlbmd0aCAtIDFdLnNsaWNlKDAsIGFyZ3NbYXJncy5sZW5ndGggLSAyXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCQyID09PSBcIidcIikgcmV0dXJuIGFyZ3NbYXJncy5sZW5ndGggLSAxXS5zbGljZShhcmdzW2FyZ3MubGVuZ3RoIC0gMl0gKyBhcmdzWzBdLmxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gRWxzZSwgbnVtYmVyZWQgYmFja3JlZmVyZW5jZSAod2l0aG91dCBjdXJseSBicmFja2V0cylcclxuICAgICAgICAgICAgICAgICAgICAkMiA9ICskMjsgLy8gVHlwZS1jb252ZXJ0OyBkcm9wIGxlYWRpbmcgemVyb1xyXG4gICAgICAgICAgICAgICAgICAgIC8qIFhSZWdFeHAgYmVoYXZpb3I6XHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBCYWNrcmVmZXJlbmNlcyB3aXRob3V0IGN1cmx5IGJyYWNrZXRzIGVuZCBhZnRlciAxIG9yIDIgZGlnaXRzLiBVc2UgYCR7Li59YCBmb3IgbW9yZSBkaWdpdHMuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDFgIGlzIGFuIGVycm9yIGlmIHRoZXJlIGFyZSBubyBjYXB0dXJpbmcgZ3JvdXBzLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIC0gYCQxMGAgaXMgYW4gZXJyb3IgaWYgdGhlcmUgYXJlIGxlc3MgdGhhbiAxMCBjYXB0dXJpbmcgZ3JvdXBzLiBVc2UgYCR7MX0wYCBpbnN0ZWFkLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIC0gYCQwMWAgaXMgZXF1aXZhbGVudCB0byBgJDFgIGlmIGEgY2FwdHVyaW5nIGdyb3VwIGV4aXN0cywgb3RoZXJ3aXNlIGl0J3MgYW4gZXJyb3IuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDBgIChub3QgZm9sbG93ZWQgYnkgMS05KSwgYCQwMGAsIGFuZCBgJCZgIGFyZSB0aGUgZW50aXJlIG1hdGNoLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIE5hdGl2ZSBiZWhhdmlvciwgZm9yIGNvbXBhcmlzb246XHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBCYWNrcmVmZXJlbmNlcyBlbmQgYWZ0ZXIgMSBvciAyIGRpZ2l0cy4gQ2Fubm90IHVzZSBiYWNrcmVmZXJlbmNlIHRvIGNhcHR1cmluZyBncm91cCAxMDArLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIC0gYCQxYCBpcyBhIGxpdGVyYWwgYCQxYCBpZiB0aGVyZSBhcmUgbm8gY2FwdHVyaW5nIGdyb3Vwcy5cclxuICAgICAgICAgICAgICAgICAgICAgKiAtIGAkMTBgIGlzIGAkMWAgZm9sbG93ZWQgYnkgYSBsaXRlcmFsIGAwYCBpZiB0aGVyZSBhcmUgbGVzcyB0aGFuIDEwIGNhcHR1cmluZyBncm91cHMuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDAxYCBpcyBlcXVpdmFsZW50IHRvIGAkMWAgaWYgYSBjYXB0dXJpbmcgZ3JvdXAgZXhpc3RzLCBvdGhlcndpc2UgaXQncyBhIGxpdGVyYWwgYCQwMWAuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDBgIGlzIGEgbGl0ZXJhbCBgJDBgLiBgJCZgIGlzIHRoZSBlbnRpcmUgbWF0Y2guXHJcbiAgICAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTigkMikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCQyID4gYXJncy5sZW5ndGggLSAzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJiYWNrcmVmZXJlbmNlIHRvIHVuZGVmaW5lZCBncm91cCBcIiArICQwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXJnc1skMl0gfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiaW52YWxpZCB0b2tlbiBcIiArICQwKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGlzUmVnZXgpIHtcclxuICAgICAgICAgICAgaWYgKHNlYXJjaC5nbG9iYWwpIHtcclxuICAgICAgICAgICAgICAgIHNlYXJjaC5sYXN0SW5kZXggPSAwOyAvLyBGaXhlcyBJRSwgU2FmYXJpIGJ1ZyAobGFzdCB0ZXN0ZWQgSUUgOSwgU2FmYXJpIDUuMSlcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNlYXJjaC5sYXN0SW5kZXggPSBvcmlnTGFzdEluZGV4OyAvLyBGaXhlcyBJRSwgT3BlcmEgYnVnIChsYXN0IHRlc3RlZCBJRSA5LCBPcGVyYSAxMS42KVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEZpeGVzIGJyb3dzZXIgYnVncyBpbiB0aGUgbmF0aXZlIGBTdHJpbmcucHJvdG90eXBlLnNwbGl0YC4gQ2FsbGluZyBgWFJlZ0V4cC5pbnN0YWxsKCduYXRpdmVzJylgXHJcbiAqIHVzZXMgdGhpcyB0byBvdmVycmlkZSB0aGUgbmF0aXZlIG1ldGhvZC4gVXNlIHZpYSBgWFJlZ0V4cC5zcGxpdGAgd2l0aG91dCBvdmVycmlkaW5nIG5hdGl2ZXMuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7UmVnRXhwfFN0cmluZ30gc2VwYXJhdG9yIFJlZ2V4IG9yIHN0cmluZyB0byB1c2UgZm9yIHNlcGFyYXRpbmcgdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtsaW1pdF0gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzdWx0IGFycmF5LlxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IEFycmF5IG9mIHN1YnN0cmluZ3MuXHJcbiAqL1xyXG4gICAgZml4ZWQuc3BsaXQgPSBmdW5jdGlvbiAoc2VwYXJhdG9yLCBsaW1pdCkge1xyXG4gICAgICAgIGlmICghc2VsZi5pc1JlZ0V4cChzZXBhcmF0b3IpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuYXRpdi5zcGxpdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyAvLyB1c2UgZmFzdGVyIG5hdGl2ZSBtZXRob2RcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHN0ciA9IFN0cmluZyh0aGlzKSxcclxuICAgICAgICAgICAgb3JpZ0xhc3RJbmRleCA9IHNlcGFyYXRvci5sYXN0SW5kZXgsXHJcbiAgICAgICAgICAgIG91dHB1dCA9IFtdLFxyXG4gICAgICAgICAgICBsYXN0TGFzdEluZGV4ID0gMCxcclxuICAgICAgICAgICAgbGFzdExlbmd0aDtcclxuICAgICAgICAvKiBWYWx1ZXMgZm9yIGBsaW1pdGAsIHBlciB0aGUgc3BlYzpcclxuICAgICAgICAgKiBJZiB1bmRlZmluZWQ6IHBvdygyLDMyKSAtIDFcclxuICAgICAgICAgKiBJZiAwLCBJbmZpbml0eSwgb3IgTmFOOiAwXHJcbiAgICAgICAgICogSWYgcG9zaXRpdmUgbnVtYmVyOiBsaW1pdCA9IGZsb29yKGxpbWl0KTsgaWYgKGxpbWl0ID49IHBvdygyLDMyKSkgbGltaXQgLT0gcG93KDIsMzIpO1xyXG4gICAgICAgICAqIElmIG5lZ2F0aXZlIG51bWJlcjogcG93KDIsMzIpIC0gZmxvb3IoYWJzKGxpbWl0KSlcclxuICAgICAgICAgKiBJZiBvdGhlcjogVHlwZS1jb252ZXJ0LCB0aGVuIHVzZSB0aGUgYWJvdmUgcnVsZXNcclxuICAgICAgICAgKi9cclxuICAgICAgICBsaW1pdCA9IChsaW1pdCA9PT0gdW5kZWYgPyAtMSA6IGxpbWl0KSA+Pj4gMDtcclxuICAgICAgICBzZWxmLmZvckVhY2goc3RyLCBzZXBhcmF0b3IsIGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICBpZiAoKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKSA+IGxhc3RMYXN0SW5kZXgpIHsgLy8gIT0gYGlmIChtYXRjaFswXS5sZW5ndGgpYFxyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XHJcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gubGVuZ3RoID4gMSAmJiBtYXRjaC5pbmRleCA8IHN0ci5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShvdXRwdXQsIG1hdGNoLnNsaWNlKDEpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxhc3RMZW5ndGggPSBtYXRjaFswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBsYXN0TGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyBsYXN0TGVuZ3RoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGxhc3RMYXN0SW5kZXggPT09IHN0ci5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaWYgKCFuYXRpdi50ZXN0LmNhbGwoc2VwYXJhdG9yLCBcIlwiKSB8fCBsYXN0TGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChcIlwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNlcGFyYXRvci5sYXN0SW5kZXggPSBvcmlnTGFzdEluZGV4O1xyXG4gICAgICAgIHJldHVybiBvdXRwdXQubGVuZ3RoID4gbGltaXQgPyBvdXRwdXQuc2xpY2UoMCwgbGltaXQpIDogb3V0cHV0O1xyXG4gICAgfTtcclxuXHJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIEJ1aWx0LWluIHRva2Vuc1xyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4vLyBTaG9ydGN1dFxyXG4gICAgYWRkID0gYWRkVG9rZW4ub247XHJcblxyXG4vKiBMZXR0ZXIgaWRlbnRpdHkgZXNjYXBlcyB0aGF0IG5hdGl2ZWx5IG1hdGNoIGxpdGVyYWwgY2hhcmFjdGVyczogXFxwLCBcXFAsIGV0Yy5cclxuICogU2hvdWxkIGJlIFN5bnRheEVycm9ycyBidXQgYXJlIGFsbG93ZWQgaW4gd2ViIHJlYWxpdHkuIFhSZWdFeHAgbWFrZXMgdGhlbSBlcnJvcnMgZm9yIGNyb3NzLVxyXG4gKiBicm93c2VyIGNvbnNpc3RlbmN5IGFuZCB0byByZXNlcnZlIHRoZWlyIHN5bnRheCwgYnV0IGxldHMgdGhlbSBiZSBzdXBlcnNlZGVkIGJ5IFhSZWdFeHAgYWRkb25zLlxyXG4gKi9cclxuICAgIGFkZCgvXFxcXChbQUJDRS1SVFVWWFlaYWVnLW1vcHF5el18Yyg/IVtBLVphLXpdKXx1KD8hW1xcZEEtRmEtZl17NH0pfHgoPyFbXFxkQS1GYS1mXXsyfSkpLyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gsIHNjb3BlKSB7XHJcbiAgICAgICAgICAgIC8vIFxcQiBpcyBhbGxvd2VkIGluIGRlZmF1bHQgc2NvcGUgb25seVxyXG4gICAgICAgICAgICBpZiAobWF0Y2hbMV0gPT09IFwiQlwiICYmIHNjb3BlID09PSBkZWZhdWx0U2NvcGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaFswXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJpbnZhbGlkIGVzY2FwZSBcIiArIG1hdGNoWzBdKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtzY29wZTogXCJhbGxcIn0pO1xyXG5cclxuLyogRW1wdHkgY2hhcmFjdGVyIGNsYXNzOiBbXSBvciBbXl1cclxuICogRml4ZXMgYSBjcml0aWNhbCBjcm9zcy1icm93c2VyIHN5bnRheCBpbmNvbnNpc3RlbmN5LiBVbmxlc3MgdGhpcyBpcyBzdGFuZGFyZGl6ZWQgKHBlciB0aGUgc3BlYyksXHJcbiAqIHJlZ2V4IHN5bnRheCBjYW4ndCBiZSBhY2N1cmF0ZWx5IHBhcnNlZCBiZWNhdXNlIGNoYXJhY3RlciBjbGFzcyBlbmRpbmdzIGNhbid0IGJlIGRldGVybWluZWQuXHJcbiAqL1xyXG4gICAgYWRkKC9cXFsoXFxePyldLyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgLy8gRm9yIGNyb3NzLWJyb3dzZXIgY29tcGF0aWJpbGl0eSB3aXRoIEVTMywgY29udmVydCBbXSB0byBcXGJcXEIgYW5kIFteXSB0byBbXFxzXFxTXS5cclxuICAgICAgICAgICAgLy8gKD8hKSBzaG91bGQgd29yayBsaWtlIFxcYlxcQiwgYnV0IGlzIHVucmVsaWFibGUgaW4gRmlyZWZveFxyXG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hbMV0gPyBcIltcXFxcc1xcXFxTXVwiIDogXCJcXFxcYlxcXFxCXCI7XHJcbiAgICAgICAgfSk7XHJcblxyXG4vKiBDb21tZW50IHBhdHRlcm46ICg/IyApXHJcbiAqIElubGluZSBjb21tZW50cyBhcmUgYW4gYWx0ZXJuYXRpdmUgdG8gdGhlIGxpbmUgY29tbWVudHMgYWxsb3dlZCBpbiBmcmVlLXNwYWNpbmcgbW9kZSAoZmxhZyB4KS5cclxuICovXHJcbiAgICBhZGQoLyg/OlxcKFxcPyNbXildKlxcKSkrLyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgLy8gS2VlcCB0b2tlbnMgc2VwYXJhdGVkIHVubGVzcyB0aGUgZm9sbG93aW5nIHRva2VuIGlzIGEgcXVhbnRpZmllclxyXG4gICAgICAgICAgICByZXR1cm4gbmF0aXYudGVzdC5jYWxsKHF1YW50aWZpZXIsIG1hdGNoLmlucHV0LnNsaWNlKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKSkgPyBcIlwiIDogXCIoPzopXCI7XHJcbiAgICAgICAgfSk7XHJcblxyXG4vKiBOYW1lZCBiYWNrcmVmZXJlbmNlOiBcXGs8bmFtZT5cclxuICogQmFja3JlZmVyZW5jZSBuYW1lcyBjYW4gdXNlIHRoZSBjaGFyYWN0ZXJzIEEtWiwgYS16LCAwLTksIF8sIGFuZCAkIG9ubHkuXHJcbiAqL1xyXG4gICAgYWRkKC9cXFxcazwoW1xcdyRdKyk+LyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gaXNOYU4obWF0Y2hbMV0pID8gKGxhc3RJbmRleE9mKHRoaXMuY2FwdHVyZU5hbWVzLCBtYXRjaFsxXSkgKyAxKSA6ICttYXRjaFsxXSxcclxuICAgICAgICAgICAgICAgIGVuZEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgIGlmICghaW5kZXggfHwgaW5kZXggPiB0aGlzLmNhcHR1cmVOYW1lcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImJhY2tyZWZlcmVuY2UgdG8gdW5kZWZpbmVkIGdyb3VwIFwiICsgbWF0Y2hbMF0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIEtlZXAgYmFja3JlZmVyZW5jZXMgc2VwYXJhdGUgZnJvbSBzdWJzZXF1ZW50IGxpdGVyYWwgbnVtYmVyc1xyXG4gICAgICAgICAgICByZXR1cm4gXCJcXFxcXCIgKyBpbmRleCArIChcclxuICAgICAgICAgICAgICAgIGVuZEluZGV4ID09PSBtYXRjaC5pbnB1dC5sZW5ndGggfHwgaXNOYU4obWF0Y2guaW5wdXQuY2hhckF0KGVuZEluZGV4KSkgPyBcIlwiIDogXCIoPzopXCJcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9KTtcclxuXHJcbi8qIFdoaXRlc3BhY2UgYW5kIGxpbmUgY29tbWVudHMsIGluIGZyZWUtc3BhY2luZyBtb2RlIChha2EgZXh0ZW5kZWQgbW9kZSwgZmxhZyB4KSBvbmx5LlxyXG4gKi9cclxuICAgIGFkZCgvKD86XFxzK3wjLiopKy8sXHJcbiAgICAgICAgZnVuY3Rpb24gKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vIEtlZXAgdG9rZW5zIHNlcGFyYXRlZCB1bmxlc3MgdGhlIGZvbGxvd2luZyB0b2tlbiBpcyBhIHF1YW50aWZpZXJcclxuICAgICAgICAgICAgcmV0dXJuIG5hdGl2LnRlc3QuY2FsbChxdWFudGlmaWVyLCBtYXRjaC5pbnB1dC5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCkpID8gXCJcIiA6IFwiKD86KVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0cmlnZ2VyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oYXNGbGFnKFwieFwiKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY3VzdG9tRmxhZ3M6IFwieFwiXHJcbiAgICAgICAgfSk7XHJcblxyXG4vKiBEb3QsIGluIGRvdGFsbCBtb2RlIChha2Egc2luZ2xlbGluZSBtb2RlLCBmbGFnIHMpIG9ubHkuXHJcbiAqL1xyXG4gICAgYWRkKC9cXC4vLFxyXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiW1xcXFxzXFxcXFNdXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHRyaWdnZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhhc0ZsYWcoXCJzXCIpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjdXN0b21GbGFnczogXCJzXCJcclxuICAgICAgICB9KTtcclxuXHJcbi8qIE5hbWVkIGNhcHR1cmluZyBncm91cDsgbWF0Y2ggdGhlIG9wZW5pbmcgZGVsaW1pdGVyIG9ubHk6ICg/PG5hbWU+XHJcbiAqIENhcHR1cmUgbmFtZXMgY2FuIHVzZSB0aGUgY2hhcmFjdGVycyBBLVosIGEteiwgMC05LCBfLCBhbmQgJCBvbmx5LiBOYW1lcyBjYW4ndCBiZSBpbnRlZ2Vycy5cclxuICogU3VwcG9ydHMgUHl0aG9uLXN0eWxlICg/UDxuYW1lPiBhcyBhbiBhbHRlcm5hdGUgc3ludGF4IHRvIGF2b2lkIGlzc3VlcyBpbiByZWNlbnQgT3BlcmEgKHdoaWNoXHJcbiAqIG5hdGl2ZWx5IHN1cHBvcnRzIHRoZSBQeXRob24tc3R5bGUgc3ludGF4KS4gT3RoZXJ3aXNlLCBYUmVnRXhwIG1pZ2h0IHRyZWF0IG51bWJlcmVkXHJcbiAqIGJhY2tyZWZlcmVuY2VzIHRvIFB5dGhvbi1zdHlsZSBuYW1lZCBjYXB0dXJlIGFzIG9jdGFscy5cclxuICovXHJcbiAgICBhZGQoL1xcKFxcP1A/PChbXFx3JF0rKT4vLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICBpZiAoIWlzTmFOKG1hdGNoWzFdKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gQXZvaWQgaW5jb3JyZWN0IGxvb2t1cHMsIHNpbmNlIG5hbWVkIGJhY2tyZWZlcmVuY2VzIGFyZSBhZGRlZCB0byBtYXRjaCBhcnJheXNcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImNhbid0IHVzZSBpbnRlZ2VyIGFzIGNhcHR1cmUgbmFtZSBcIiArIG1hdGNoWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmNhcHR1cmVOYW1lcy5wdXNoKG1hdGNoWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5oYXNOYW1lZENhcHR1cmUgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm4gXCIoXCI7XHJcbiAgICAgICAgfSk7XHJcblxyXG4vKiBOdW1iZXJlZCBiYWNrcmVmZXJlbmNlIG9yIG9jdGFsLCBwbHVzIGFueSBmb2xsb3dpbmcgZGlnaXRzOiBcXDAsIFxcMTEsIGV0Yy5cclxuICogT2N0YWxzIGV4Y2VwdCBcXDAgbm90IGZvbGxvd2VkIGJ5IDAtOSBhbmQgYmFja3JlZmVyZW5jZXMgdG8gdW5vcGVuZWQgY2FwdHVyZSBncm91cHMgdGhyb3cgYW5cclxuICogZXJyb3IuIE90aGVyIG1hdGNoZXMgYXJlIHJldHVybmVkIHVuYWx0ZXJlZC4gSUUgPD0gOCBkb2Vzbid0IHN1cHBvcnQgYmFja3JlZmVyZW5jZXMgZ3JlYXRlciB0aGFuXHJcbiAqIFxcOTkgaW4gcmVnZXggc3ludGF4LlxyXG4gKi9cclxuICAgIGFkZCgvXFxcXChcXGQrKS8sXHJcbiAgICAgICAgZnVuY3Rpb24gKG1hdGNoLCBzY29wZSkge1xyXG4gICAgICAgICAgICBpZiAoIShzY29wZSA9PT0gZGVmYXVsdFNjb3BlICYmIC9eWzEtOV0vLnRlc3QobWF0Y2hbMV0pICYmICttYXRjaFsxXSA8PSB0aGlzLmNhcHR1cmVOYW1lcy5sZW5ndGgpICYmXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hbMV0gIT09IFwiMFwiKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJjYW4ndCB1c2Ugb2N0YWwgZXNjYXBlIG9yIGJhY2tyZWZlcmVuY2UgdG8gdW5kZWZpbmVkIGdyb3VwIFwiICsgbWF0Y2hbMF0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBtYXRjaFswXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtzY29wZTogXCJhbGxcIn0pO1xyXG5cclxuLyogQ2FwdHVyaW5nIGdyb3VwOyBtYXRjaCB0aGUgb3BlbmluZyBwYXJlbnRoZXNpcyBvbmx5LlxyXG4gKiBSZXF1aXJlZCBmb3Igc3VwcG9ydCBvZiBuYW1lZCBjYXB0dXJpbmcgZ3JvdXBzLiBBbHNvIGFkZHMgZXhwbGljaXQgY2FwdHVyZSBtb2RlIChmbGFnIG4pLlxyXG4gKi9cclxuICAgIGFkZCgvXFwoKD8hXFw/KS8sXHJcbiAgICAgICAgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNGbGFnKFwiblwiKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiKD86XCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jYXB0dXJlTmFtZXMucHVzaChudWxsKTtcclxuICAgICAgICAgICAgcmV0dXJuIFwiKFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge2N1c3RvbUZsYWdzOiBcIm5cIn0pO1xyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgRXhwb3NlIFhSZWdFeHBcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLy8gRm9yIENvbW1vbkpTIGVudmlyb21lbnRzXHJcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICBleHBvcnRzLlhSZWdFeHAgPSBzZWxmO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBzZWxmO1xyXG5cclxufSgpKTtcclxuXHJcblxuLyoqKioqIHVuaWNvZGUtYmFzZS5qcyAqKioqKi9cblxuLyohXHJcbiAqIFhSZWdFeHAgVW5pY29kZSBCYXNlIHYxLjAuMFxyXG4gKiAoYykgMjAwOC0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICogVXNlcyBVbmljb2RlIDYuMSA8aHR0cDovL3VuaWNvZGUub3JnLz5cclxuICovXHJcblxyXG4vKipcclxuICogQWRkcyBzdXBwb3J0IGZvciB0aGUgYFxccHtMfWAgb3IgYFxccHtMZXR0ZXJ9YCBVbmljb2RlIGNhdGVnb3J5LiBBZGRvbiBwYWNrYWdlcyBmb3Igb3RoZXIgVW5pY29kZVxyXG4gKiBjYXRlZ29yaWVzLCBzY3JpcHRzLCBibG9ja3MsIGFuZCBwcm9wZXJ0aWVzIGFyZSBhdmFpbGFibGUgc2VwYXJhdGVseS4gQWxsIFVuaWNvZGUgdG9rZW5zIGNhbiBiZVxyXG4gKiBpbnZlcnRlZCB1c2luZyBgXFxQey4ufWAgb3IgYFxccHteLi59YC4gVG9rZW4gbmFtZXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBhbnkgc3BhY2VzLCBoeXBoZW5zLFxyXG4gKiBhbmQgdW5kZXJzY29yZXMgYXJlIGlnbm9yZWQuXHJcbiAqIEByZXF1aXJlcyBYUmVnRXhwXHJcbiAqL1xyXG4oZnVuY3Rpb24gKFhSZWdFeHApIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIHZhciB1bmljb2RlID0ge307XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBQcml2YXRlIGhlbHBlciBmdW5jdGlvbnNcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLy8gR2VuZXJhdGVzIGEgc3RhbmRhcmRpemVkIHRva2VuIG5hbWUgKGxvd2VyY2FzZSwgd2l0aCBoeXBoZW5zLCBzcGFjZXMsIGFuZCB1bmRlcnNjb3JlcyByZW1vdmVkKVxyXG4gICAgZnVuY3Rpb24gc2x1ZyhuYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvWy0gX10rL2csIFwiXCIpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICB9XHJcblxyXG4vLyBFeHBhbmRzIGEgbGlzdCBvZiBVbmljb2RlIGNvZGUgcG9pbnRzIGFuZCByYW5nZXMgdG8gYmUgdXNhYmxlIGluIGEgcmVnZXggY2hhcmFjdGVyIGNsYXNzXHJcbiAgICBmdW5jdGlvbiBleHBhbmQoc3RyKSB7XHJcbiAgICAgICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXHd7NH0vZywgXCJcXFxcdSQmXCIpO1xyXG4gICAgfVxyXG5cclxuLy8gQWRkcyBsZWFkaW5nIHplcm9zIGlmIHNob3J0ZXIgdGhhbiBmb3VyIGNoYXJhY3RlcnNcclxuICAgIGZ1bmN0aW9uIHBhZDQoc3RyKSB7XHJcbiAgICAgICAgd2hpbGUgKHN0ci5sZW5ndGggPCA0KSB7XHJcbiAgICAgICAgICAgIHN0ciA9IFwiMFwiICsgc3RyO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc3RyO1xyXG4gICAgfVxyXG5cclxuLy8gQ29udmVydHMgYSBoZXhhZGVjaW1hbCBudW1iZXIgdG8gZGVjaW1hbFxyXG4gICAgZnVuY3Rpb24gZGVjKGhleCkge1xyXG4gICAgICAgIHJldHVybiBwYXJzZUludChoZXgsIDE2KTtcclxuICAgIH1cclxuXHJcbi8vIENvbnZlcnRzIGEgZGVjaW1hbCBudW1iZXIgdG8gaGV4YWRlY2ltYWxcclxuICAgIGZ1bmN0aW9uIGhleChkZWMpIHtcclxuICAgICAgICByZXR1cm4gcGFyc2VJbnQoZGVjLCAxMCkudG9TdHJpbmcoMTYpO1xyXG4gICAgfVxyXG5cclxuLy8gSW52ZXJ0cyBhIGxpc3Qgb2YgVW5pY29kZSBjb2RlIHBvaW50cyBhbmQgcmFuZ2VzXHJcbiAgICBmdW5jdGlvbiBpbnZlcnQocmFuZ2UpIHtcclxuICAgICAgICB2YXIgb3V0cHV0ID0gW10sXHJcbiAgICAgICAgICAgIGxhc3RFbmQgPSAtMSxcclxuICAgICAgICAgICAgc3RhcnQ7XHJcbiAgICAgICAgWFJlZ0V4cC5mb3JFYWNoKHJhbmdlLCAvXFxcXHUoXFx3ezR9KSg/Oi1cXFxcdShcXHd7NH0pKT8vLCBmdW5jdGlvbiAobSkge1xyXG4gICAgICAgICAgICBzdGFydCA9IGRlYyhtWzFdKTtcclxuICAgICAgICAgICAgaWYgKHN0YXJ0ID4gKGxhc3RFbmQgKyAxKSkge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goXCJcXFxcdVwiICsgcGFkNChoZXgobGFzdEVuZCArIDEpKSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3RhcnQgPiAobGFzdEVuZCArIDIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goXCItXFxcXHVcIiArIHBhZDQoaGV4KHN0YXJ0IC0gMSkpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsYXN0RW5kID0gZGVjKG1bMl0gfHwgbVsxXSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGxhc3RFbmQgPCAweEZGRkYpIHtcclxuICAgICAgICAgICAgb3V0cHV0LnB1c2goXCJcXFxcdVwiICsgcGFkNChoZXgobGFzdEVuZCArIDEpKSk7XHJcbiAgICAgICAgICAgIGlmIChsYXN0RW5kIDwgMHhGRkZFKSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChcIi1cXFxcdUZGRkZcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG91dHB1dC5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuLy8gR2VuZXJhdGVzIGFuIGludmVydGVkIHRva2VuIG9uIGZpcnN0IHVzZVxyXG4gICAgZnVuY3Rpb24gY2FjaGVJbnZlcnNpb24oaXRlbSkge1xyXG4gICAgICAgIHJldHVybiB1bmljb2RlW1wiXlwiICsgaXRlbV0gfHwgKHVuaWNvZGVbXCJeXCIgKyBpdGVtXSA9IGludmVydCh1bmljb2RlW2l0ZW1dKSk7XHJcbiAgICB9XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBDb3JlIGZ1bmN0aW9uYWxpdHlcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIFhSZWdFeHAuaW5zdGFsbChcImV4dGVuc2liaWxpdHlcIik7XHJcblxyXG4vKipcclxuICogQWRkcyB0byB0aGUgbGlzdCBvZiBVbmljb2RlIHByb3BlcnRpZXMgdGhhdCBYUmVnRXhwIHJlZ2V4ZXMgY2FuIG1hdGNoIHZpYSBcXHB7Li59IG9yIFxcUHsuLn0uXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrIE5hbWVkIHNldHMgb2YgVW5pY29kZSBjb2RlIHBvaW50cyBhbmQgcmFuZ2VzLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2FsaWFzZXNdIEFsaWFzZXMgZm9yIHRoZSBwcmltYXJ5IHRva2VuIG5hbWVzLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKHtcclxuICogICBYRGlnaXQ6ICcwMDMwLTAwMzkwMDQxLTAwNDYwMDYxLTAwNjYnIC8vIDAtOUEtRmEtZlxyXG4gKiB9LCB7XHJcbiAqICAgWERpZ2l0OiAnSGV4YWRlY2ltYWwnXHJcbiAqIH0pO1xyXG4gKi9cclxuICAgIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2UgPSBmdW5jdGlvbiAocGFjaywgYWxpYXNlcykge1xyXG4gICAgICAgIHZhciBwO1xyXG4gICAgICAgIGlmICghWFJlZ0V4cC5pc0luc3RhbGxlZChcImV4dGVuc2liaWxpdHlcIikpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXh0ZW5zaWJpbGl0eSBtdXN0IGJlIGluc3RhbGxlZCBiZWZvcmUgYWRkaW5nIFVuaWNvZGUgcGFja2FnZXNcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChwYWNrKSB7XHJcbiAgICAgICAgICAgIGZvciAocCBpbiBwYWNrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFjay5oYXNPd25Qcm9wZXJ0eShwKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHVuaWNvZGVbc2x1ZyhwKV0gPSBleHBhbmQocGFja1twXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGFsaWFzZXMpIHtcclxuICAgICAgICAgICAgZm9yIChwIGluIGFsaWFzZXMpIHtcclxuICAgICAgICAgICAgICAgIGlmIChhbGlhc2VzLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdW5pY29kZVtzbHVnKGFsaWFzZXNbcF0pXSA9IHVuaWNvZGVbc2x1ZyhwKV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLyogQWRkcyBkYXRhIGZvciB0aGUgVW5pY29kZSBgTGV0dGVyYCBjYXRlZ29yeS4gQWRkb24gcGFja2FnZXMgaW5jbHVkZSBvdGhlciBjYXRlZ29yaWVzLCBzY3JpcHRzLFxyXG4gKiBibG9ja3MsIGFuZCBwcm9wZXJ0aWVzLlxyXG4gKi9cclxuICAgIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2Uoe1xyXG4gICAgICAgIEw6IFwiMDA0MS0wMDVBMDA2MS0wMDdBMDBBQTAwQjUwMEJBMDBDMC0wMEQ2MDBEOC0wMEY2MDBGOC0wMkMxMDJDNi0wMkQxMDJFMC0wMkU0MDJFQzAyRUUwMzcwLTAzNzQwMzc2MDM3NzAzN0EtMDM3RDAzODYwMzg4LTAzOEEwMzhDMDM4RS0wM0ExMDNBMy0wM0Y1MDNGNy0wNDgxMDQ4QS0wNTI3MDUzMS0wNTU2MDU1OTA1NjEtMDU4NzA1RDAtMDVFQTA1RjAtMDVGMjA2MjAtMDY0QTA2NkUwNjZGMDY3MS0wNkQzMDZENTA2RTUwNkU2MDZFRTA2RUYwNkZBLTA2RkMwNkZGMDcxMDA3MTItMDcyRjA3NEQtMDdBNTA3QjEwN0NBLTA3RUEwN0Y0MDdGNTA3RkEwODAwLTA4MTUwODFBMDgyNDA4MjgwODQwLTA4NTgwOEEwMDhBMi0wOEFDMDkwNC0wOTM5MDkzRDA5NTAwOTU4LTA5NjEwOTcxLTA5NzcwOTc5LTA5N0YwOTg1LTA5OEMwOThGMDk5MDA5OTMtMDlBODA5QUEtMDlCMDA5QjIwOUI2LTA5QjkwOUJEMDlDRTA5REMwOUREMDlERi0wOUUxMDlGMDA5RjEwQTA1LTBBMEEwQTBGMEExMDBBMTMtMEEyODBBMkEtMEEzMDBBMzIwQTMzMEEzNTBBMzYwQTM4MEEzOTBBNTktMEE1QzBBNUUwQTcyLTBBNzQwQTg1LTBBOEQwQThGLTBBOTEwQTkzLTBBQTgwQUFBLTBBQjAwQUIyMEFCMzBBQjUtMEFCOTBBQkQwQUQwMEFFMDBBRTEwQjA1LTBCMEMwQjBGMEIxMDBCMTMtMEIyODBCMkEtMEIzMDBCMzIwQjMzMEIzNS0wQjM5MEIzRDBCNUMwQjVEMEI1Ri0wQjYxMEI3MTBCODMwQjg1LTBCOEEwQjhFLTBCOTAwQjkyLTBCOTUwQjk5MEI5QTBCOUMwQjlFMEI5RjBCQTMwQkE0MEJBOC0wQkFBMEJBRS0wQkI5MEJEMDBDMDUtMEMwQzBDMEUtMEMxMDBDMTItMEMyODBDMkEtMEMzMzBDMzUtMEMzOTBDM0QwQzU4MEM1OTBDNjAwQzYxMEM4NS0wQzhDMEM4RS0wQzkwMEM5Mi0wQ0E4MENBQS0wQ0IzMENCNS0wQ0I5MENCRDBDREUwQ0UwMENFMTBDRjEwQ0YyMEQwNS0wRDBDMEQwRS0wRDEwMEQxMi0wRDNBMEQzRDBENEUwRDYwMEQ2MTBEN0EtMEQ3RjBEODUtMEQ5NjBEOUEtMERCMTBEQjMtMERCQjBEQkQwREMwLTBEQzYwRTAxLTBFMzAwRTMyMEUzMzBFNDAtMEU0NjBFODEwRTgyMEU4NDBFODcwRTg4MEU4QTBFOEQwRTk0LTBFOTcwRTk5LTBFOUYwRUExLTBFQTMwRUE1MEVBNzBFQUEwRUFCMEVBRC0wRUIwMEVCMjBFQjMwRUJEMEVDMC0wRUM0MEVDNjBFREMtMEVERjBGMDAwRjQwLTBGNDcwRjQ5LTBGNkMwRjg4LTBGOEMxMDAwLTEwMkExMDNGMTA1MC0xMDU1MTA1QS0xMDVEMTA2MTEwNjUxMDY2MTA2RS0xMDcwMTA3NS0xMDgxMTA4RTEwQTAtMTBDNTEwQzcxMENEMTBEMC0xMEZBMTBGQy0xMjQ4MTI0QS0xMjREMTI1MC0xMjU2MTI1ODEyNUEtMTI1RDEyNjAtMTI4ODEyOEEtMTI4RDEyOTAtMTJCMDEyQjItMTJCNTEyQjgtMTJCRTEyQzAxMkMyLTEyQzUxMkM4LTEyRDYxMkQ4LTEzMTAxMzEyLTEzMTUxMzE4LTEzNUExMzgwLTEzOEYxM0EwLTEzRjQxNDAxLTE2NkMxNjZGLTE2N0YxNjgxLTE2OUExNkEwLTE2RUExNzAwLTE3MEMxNzBFLTE3MTExNzIwLTE3MzExNzQwLTE3NTExNzYwLTE3NkMxNzZFLTE3NzAxNzgwLTE3QjMxN0Q3MTdEQzE4MjAtMTg3NzE4ODAtMThBODE4QUExOEIwLTE4RjUxOTAwLTE5MUMxOTUwLTE5NkQxOTcwLTE5NzQxOTgwLTE5QUIxOUMxLTE5QzcxQTAwLTFBMTYxQTIwLTFBNTQxQUE3MUIwNS0xQjMzMUI0NS0xQjRCMUI4My0xQkEwMUJBRTFCQUYxQkJBLTFCRTUxQzAwLTFDMjMxQzRELTFDNEYxQzVBLTFDN0QxQ0U5LTFDRUMxQ0VFLTFDRjExQ0Y1MUNGNjFEMDAtMURCRjFFMDAtMUYxNTFGMTgtMUYxRDFGMjAtMUY0NTFGNDgtMUY0RDFGNTAtMUY1NzFGNTkxRjVCMUY1RDFGNUYtMUY3RDFGODAtMUZCNDFGQjYtMUZCQzFGQkUxRkMyLTFGQzQxRkM2LTFGQ0MxRkQwLTFGRDMxRkQ2LTFGREIxRkUwLTFGRUMxRkYyLTFGRjQxRkY2LTFGRkMyMDcxMjA3RjIwOTAtMjA5QzIxMDIyMTA3MjEwQS0yMTEzMjExNTIxMTktMjExRDIxMjQyMTI2MjEyODIxMkEtMjEyRDIxMkYtMjEzOTIxM0MtMjEzRjIxNDUtMjE0OTIxNEUyMTgzMjE4NDJDMDAtMkMyRTJDMzAtMkM1RTJDNjAtMkNFNDJDRUItMkNFRTJDRjIyQ0YzMkQwMC0yRDI1MkQyNzJEMkQyRDMwLTJENjcyRDZGMkQ4MC0yRDk2MkRBMC0yREE2MkRBOC0yREFFMkRCMC0yREI2MkRCOC0yREJFMkRDMC0yREM2MkRDOC0yRENFMkREMC0yREQ2MkREOC0yRERFMkUyRjMwMDUzMDA2MzAzMS0zMDM1MzAzQjMwM0MzMDQxLTMwOTYzMDlELTMwOUYzMEExLTMwRkEzMEZDLTMwRkYzMTA1LTMxMkQzMTMxLTMxOEUzMUEwLTMxQkEzMUYwLTMxRkYzNDAwLTREQjU0RTAwLTlGQ0NBMDAwLUE0OENBNEQwLUE0RkRBNTAwLUE2MENBNjEwLUE2MUZBNjJBQTYyQkE2NDAtQTY2RUE2N0YtQTY5N0E2QTAtQTZFNUE3MTctQTcxRkE3MjItQTc4OEE3OEItQTc4RUE3OTAtQTc5M0E3QTAtQTdBQUE3RjgtQTgwMUE4MDMtQTgwNUE4MDctQTgwQUE4MEMtQTgyMkE4NDAtQTg3M0E4ODItQThCM0E4RjItQThGN0E4RkJBOTBBLUE5MjVBOTMwLUE5NDZBOTYwLUE5N0NBOTg0LUE5QjJBOUNGQUEwMC1BQTI4QUE0MC1BQTQyQUE0NC1BQTRCQUE2MC1BQTc2QUE3QUFBODAtQUFBRkFBQjFBQUI1QUFCNkFBQjktQUFCREFBQzBBQUMyQUFEQi1BQUREQUFFMC1BQUVBQUFGMi1BQUY0QUIwMS1BQjA2QUIwOS1BQjBFQUIxMS1BQjE2QUIyMC1BQjI2QUIyOC1BQjJFQUJDMC1BQkUyQUMwMC1EN0EzRDdCMC1EN0M2RDdDQi1EN0ZCRjkwMC1GQTZERkE3MC1GQUQ5RkIwMC1GQjA2RkIxMy1GQjE3RkIxREZCMUYtRkIyOEZCMkEtRkIzNkZCMzgtRkIzQ0ZCM0VGQjQwRkI0MUZCNDNGQjQ0RkI0Ni1GQkIxRkJEMy1GRDNERkQ1MC1GRDhGRkQ5Mi1GREM3RkRGMC1GREZCRkU3MC1GRTc0RkU3Ni1GRUZDRkYyMS1GRjNBRkY0MS1GRjVBRkY2Ni1GRkJFRkZDMi1GRkM3RkZDQS1GRkNGRkZEMi1GRkQ3RkZEQS1GRkRDXCJcclxuICAgIH0sIHtcclxuICAgICAgICBMOiBcIkxldHRlclwiXHJcbiAgICB9KTtcclxuXHJcbi8qIEFkZHMgVW5pY29kZSBwcm9wZXJ0eSBzeW50YXggdG8gWFJlZ0V4cDogXFxwey4ufSwgXFxQey4ufSwgXFxwe14uLn1cclxuICovXHJcbiAgICBYUmVnRXhwLmFkZFRva2VuKFxyXG4gICAgICAgIC9cXFxcKFtwUF0peyhcXF4/KShbXn1dKil9LyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gsIHNjb3BlKSB7XHJcbiAgICAgICAgICAgIHZhciBpbnYgPSAobWF0Y2hbMV0gPT09IFwiUFwiIHx8IG1hdGNoWzJdKSA/IFwiXlwiIDogXCJcIixcclxuICAgICAgICAgICAgICAgIGl0ZW0gPSBzbHVnKG1hdGNoWzNdKTtcclxuICAgICAgICAgICAgLy8gVGhlIGRvdWJsZSBuZWdhdGl2ZSBcXFB7Xi4ufSBpcyBpbnZhbGlkXHJcbiAgICAgICAgICAgIGlmIChtYXRjaFsxXSA9PT0gXCJQXCIgJiYgbWF0Y2hbMl0pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImludmFsaWQgZG91YmxlIG5lZ2F0aW9uIFxcXFxQe15cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCF1bmljb2RlLmhhc093blByb3BlcnR5KGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJpbnZhbGlkIG9yIHVua25vd24gVW5pY29kZSBwcm9wZXJ0eSBcIiArIG1hdGNoWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gc2NvcGUgPT09IFwiY2xhc3NcIiA/XHJcbiAgICAgICAgICAgICAgICAgICAgKGludiA/IGNhY2hlSW52ZXJzaW9uKGl0ZW0pIDogdW5pY29kZVtpdGVtXSkgOlxyXG4gICAgICAgICAgICAgICAgICAgIFwiW1wiICsgaW52ICsgdW5pY29kZVtpdGVtXSArIFwiXVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge3Njb3BlOiBcImFsbFwifVxyXG4gICAgKTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogdW5pY29kZS1jYXRlZ29yaWVzLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCBVbmljb2RlIENhdGVnb3JpZXMgdjEuMi4wXHJcbiAqIChjKSAyMDEwLTIwMTIgU3RldmVuIExldml0aGFuIDxodHRwOi8veHJlZ2V4cC5jb20vPlxyXG4gKiBNSVQgTGljZW5zZVxyXG4gKiBVc2VzIFVuaWNvZGUgNi4xIDxodHRwOi8vdW5pY29kZS5vcmcvPlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHN1cHBvcnQgZm9yIGFsbCBVbmljb2RlIGNhdGVnb3JpZXMgKGFrYSBwcm9wZXJ0aWVzKSBFLmcuLCBgXFxwe0x1fWAgb3JcclxuICogYFxccHtVcHBlcmNhc2UgTGV0dGVyfWAuIFRva2VuIG5hbWVzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgYW55IHNwYWNlcywgaHlwaGVucywgYW5kXHJcbiAqIHVuZGVyc2NvcmVzIGFyZSBpZ25vcmVkLlxyXG4gKiBAcmVxdWlyZXMgWFJlZ0V4cCwgWFJlZ0V4cCBVbmljb2RlIEJhc2VcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaWYgKCFYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiVW5pY29kZSBCYXNlIG11c3QgYmUgbG9hZGVkIGJlZm9yZSBVbmljb2RlIENhdGVnb3JpZXNcIik7XHJcbiAgICB9XHJcblxyXG4gICAgWFJlZ0V4cC5pbnN0YWxsKFwiZXh0ZW5zaWJpbGl0eVwiKTtcclxuXHJcbiAgICBYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKHtcclxuICAgICAgICAvL0w6IFwiXCIsIC8vIEluY2x1ZGVkIGluIHRoZSBVbmljb2RlIEJhc2UgYWRkb25cclxuICAgICAgICBMbDogXCIwMDYxLTAwN0EwMEI1MDBERi0wMEY2MDBGOC0wMEZGMDEwMTAxMDMwMTA1MDEwNzAxMDkwMTBCMDEwRDAxMEYwMTExMDExMzAxMTUwMTE3MDExOTAxMUIwMTFEMDExRjAxMjEwMTIzMDEyNTAxMjcwMTI5MDEyQjAxMkQwMTJGMDEzMTAxMzMwMTM1MDEzNzAxMzgwMTNBMDEzQzAxM0UwMTQwMDE0MjAxNDQwMTQ2MDE0ODAxNDkwMTRCMDE0RDAxNEYwMTUxMDE1MzAxNTUwMTU3MDE1OTAxNUIwMTVEMDE1RjAxNjEwMTYzMDE2NTAxNjcwMTY5MDE2QjAxNkQwMTZGMDE3MTAxNzMwMTc1MDE3NzAxN0EwMTdDMDE3RS0wMTgwMDE4MzAxODUwMTg4MDE4QzAxOEQwMTkyMDE5NTAxOTktMDE5QjAxOUUwMUExMDFBMzAxQTUwMUE4MDFBQTAxQUIwMUFEMDFCMDAxQjQwMUI2MDFCOTAxQkEwMUJELTAxQkYwMUM2MDFDOTAxQ0MwMUNFMDFEMDAxRDIwMUQ0MDFENjAxRDgwMURBMDFEQzAxREQwMURGMDFFMTAxRTMwMUU1MDFFNzAxRTkwMUVCMDFFRDAxRUYwMUYwMDFGMzAxRjUwMUY5MDFGQjAxRkQwMUZGMDIwMTAyMDMwMjA1MDIwNzAyMDkwMjBCMDIwRDAyMEYwMjExMDIxMzAyMTUwMjE3MDIxOTAyMUIwMjFEMDIxRjAyMjEwMjIzMDIyNTAyMjcwMjI5MDIyQjAyMkQwMjJGMDIzMTAyMzMtMDIzOTAyM0MwMjNGMDI0MDAyNDIwMjQ3MDI0OTAyNEIwMjREMDI0Ri0wMjkzMDI5NS0wMkFGMDM3MTAzNzMwMzc3MDM3Qi0wMzdEMDM5MDAzQUMtMDNDRTAzRDAwM0QxMDNENS0wM0Q3MDNEOTAzREIwM0REMDNERjAzRTEwM0UzMDNFNTAzRTcwM0U5MDNFQjAzRUQwM0VGLTAzRjMwM0Y1MDNGODAzRkIwM0ZDMDQzMC0wNDVGMDQ2MTA0NjMwNDY1MDQ2NzA0NjkwNDZCMDQ2RDA0NkYwNDcxMDQ3MzA0NzUwNDc3MDQ3OTA0N0IwNDdEMDQ3RjA0ODEwNDhCMDQ4RDA0OEYwNDkxMDQ5MzA0OTUwNDk3MDQ5OTA0OUIwNDlEMDQ5RjA0QTEwNEEzMDRBNTA0QTcwNEE5MDRBQjA0QUQwNEFGMDRCMTA0QjMwNEI1MDRCNzA0QjkwNEJCMDRCRDA0QkYwNEMyMDRDNDA0QzYwNEM4MDRDQTA0Q0MwNENFMDRDRjA0RDEwNEQzMDRENTA0RDcwNEQ5MDREQjA0REQwNERGMDRFMTA0RTMwNEU1MDRFNzA0RTkwNEVCMDRFRDA0RUYwNEYxMDRGMzA0RjUwNEY3MDRGOTA0RkIwNEZEMDRGRjA1MDEwNTAzMDUwNTA1MDcwNTA5MDUwQjA1MEQwNTBGMDUxMTA1MTMwNTE1MDUxNzA1MTkwNTFCMDUxRDA1MUYwNTIxMDUyMzA1MjUwNTI3MDU2MS0wNTg3MUQwMC0xRDJCMUQ2Qi0xRDc3MUQ3OS0xRDlBMUUwMTFFMDMxRTA1MUUwNzFFMDkxRTBCMUUwRDFFMEYxRTExMUUxMzFFMTUxRTE3MUUxOTFFMUIxRTFEMUUxRjFFMjExRTIzMUUyNTFFMjcxRTI5MUUyQjFFMkQxRTJGMUUzMTFFMzMxRTM1MUUzNzFFMzkxRTNCMUUzRDFFM0YxRTQxMUU0MzFFNDUxRTQ3MUU0OTFFNEIxRTREMUU0RjFFNTExRTUzMUU1NTFFNTcxRTU5MUU1QjFFNUQxRTVGMUU2MTFFNjMxRTY1MUU2NzFFNjkxRTZCMUU2RDFFNkYxRTcxMUU3MzFFNzUxRTc3MUU3OTFFN0IxRTdEMUU3RjFFODExRTgzMUU4NTFFODcxRTg5MUU4QjFFOEQxRThGMUU5MTFFOTMxRTk1LTFFOUQxRTlGMUVBMTFFQTMxRUE1MUVBNzFFQTkxRUFCMUVBRDFFQUYxRUIxMUVCMzFFQjUxRUI3MUVCOTFFQkIxRUJEMUVCRjFFQzExRUMzMUVDNTFFQzcxRUM5MUVDQjFFQ0QxRUNGMUVEMTFFRDMxRUQ1MUVENzFFRDkxRURCMUVERDFFREYxRUUxMUVFMzFFRTUxRUU3MUVFOTFFRUIxRUVEMUVFRjFFRjExRUYzMUVGNTFFRjcxRUY5MUVGQjFFRkQxRUZGLTFGMDcxRjEwLTFGMTUxRjIwLTFGMjcxRjMwLTFGMzcxRjQwLTFGNDUxRjUwLTFGNTcxRjYwLTFGNjcxRjcwLTFGN0QxRjgwLTFGODcxRjkwLTFGOTcxRkEwLTFGQTcxRkIwLTFGQjQxRkI2MUZCNzFGQkUxRkMyLTFGQzQxRkM2MUZDNzFGRDAtMUZEMzFGRDYxRkQ3MUZFMC0xRkU3MUZGMi0xRkY0MUZGNjFGRjcyMTBBMjEwRTIxMEYyMTEzMjEyRjIxMzQyMTM5MjEzQzIxM0QyMTQ2LTIxNDkyMTRFMjE4NDJDMzAtMkM1RTJDNjEyQzY1MkM2NjJDNjgyQzZBMkM2QzJDNzEyQzczMkM3NDJDNzYtMkM3QjJDODEyQzgzMkM4NTJDODcyQzg5MkM4QjJDOEQyQzhGMkM5MTJDOTMyQzk1MkM5NzJDOTkyQzlCMkM5RDJDOUYyQ0ExMkNBMzJDQTUyQ0E3MkNBOTJDQUIyQ0FEMkNBRjJDQjEyQ0IzMkNCNTJDQjcyQ0I5MkNCQjJDQkQyQ0JGMkNDMTJDQzMyQ0M1MkNDNzJDQzkyQ0NCMkNDRDJDQ0YyQ0QxMkNEMzJDRDUyQ0Q3MkNEOTJDREIyQ0REMkNERjJDRTEyQ0UzMkNFNDJDRUMyQ0VFMkNGMzJEMDAtMkQyNTJEMjcyRDJEQTY0MUE2NDNBNjQ1QTY0N0E2NDlBNjRCQTY0REE2NEZBNjUxQTY1M0E2NTVBNjU3QTY1OUE2NUJBNjVEQTY1RkE2NjFBNjYzQTY2NUE2NjdBNjY5QTY2QkE2NkRBNjgxQTY4M0E2ODVBNjg3QTY4OUE2OEJBNjhEQTY4RkE2OTFBNjkzQTY5NUE2OTdBNzIzQTcyNUE3MjdBNzI5QTcyQkE3MkRBNzJGLUE3MzFBNzMzQTczNUE3MzdBNzM5QTczQkE3M0RBNzNGQTc0MUE3NDNBNzQ1QTc0N0E3NDlBNzRCQTc0REE3NEZBNzUxQTc1M0E3NTVBNzU3QTc1OUE3NUJBNzVEQTc1RkE3NjFBNzYzQTc2NUE3NjdBNzY5QTc2QkE3NkRBNzZGQTc3MS1BNzc4QTc3QUE3N0NBNzdGQTc4MUE3ODNBNzg1QTc4N0E3OENBNzhFQTc5MUE3OTNBN0ExQTdBM0E3QTVBN0E3QTdBOUE3RkFGQjAwLUZCMDZGQjEzLUZCMTdGRjQxLUZGNUFcIixcclxuICAgICAgICBMdTogXCIwMDQxLTAwNUEwMEMwLTAwRDYwMEQ4LTAwREUwMTAwMDEwMjAxMDQwMTA2MDEwODAxMEEwMTBDMDEwRTAxMTAwMTEyMDExNDAxMTYwMTE4MDExQTAxMUMwMTFFMDEyMDAxMjIwMTI0MDEyNjAxMjgwMTJBMDEyQzAxMkUwMTMwMDEzMjAxMzQwMTM2MDEzOTAxM0IwMTNEMDEzRjAxNDEwMTQzMDE0NTAxNDcwMTRBMDE0QzAxNEUwMTUwMDE1MjAxNTQwMTU2MDE1ODAxNUEwMTVDMDE1RTAxNjAwMTYyMDE2NDAxNjYwMTY4MDE2QTAxNkMwMTZFMDE3MDAxNzIwMTc0MDE3NjAxNzgwMTc5MDE3QjAxN0QwMTgxMDE4MjAxODQwMTg2MDE4NzAxODktMDE4QjAxOEUtMDE5MTAxOTMwMTk0MDE5Ni0wMTk4MDE5QzAxOUQwMTlGMDFBMDAxQTIwMUE0MDFBNjAxQTcwMUE5MDFBQzAxQUUwMUFGMDFCMS0wMUIzMDFCNTAxQjcwMUI4MDFCQzAxQzQwMUM3MDFDQTAxQ0QwMUNGMDFEMTAxRDMwMUQ1MDFENzAxRDkwMURCMDFERTAxRTAwMUUyMDFFNDAxRTYwMUU4MDFFQTAxRUMwMUVFMDFGMTAxRjQwMUY2LTAxRjgwMUZBMDFGQzAxRkUwMjAwMDIwMjAyMDQwMjA2MDIwODAyMEEwMjBDMDIwRTAyMTAwMjEyMDIxNDAyMTYwMjE4MDIxQTAyMUMwMjFFMDIyMDAyMjIwMjI0MDIyNjAyMjgwMjJBMDIyQzAyMkUwMjMwMDIzMjAyM0EwMjNCMDIzRDAyM0UwMjQxMDI0My0wMjQ2MDI0ODAyNEEwMjRDMDI0RTAzNzAwMzcyMDM3NjAzODYwMzg4LTAzOEEwMzhDMDM4RTAzOEYwMzkxLTAzQTEwM0EzLTAzQUIwM0NGMDNEMi0wM0Q0MDNEODAzREEwM0RDMDNERTAzRTAwM0UyMDNFNDAzRTYwM0U4MDNFQTAzRUMwM0VFMDNGNDAzRjcwM0Y5MDNGQTAzRkQtMDQyRjA0NjAwNDYyMDQ2NDA0NjYwNDY4MDQ2QTA0NkMwNDZFMDQ3MDA0NzIwNDc0MDQ3NjA0NzgwNDdBMDQ3QzA0N0UwNDgwMDQ4QTA0OEMwNDhFMDQ5MDA0OTIwNDk0MDQ5NjA0OTgwNDlBMDQ5QzA0OUUwNEEwMDRBMjA0QTQwNEE2MDRBODA0QUEwNEFDMDRBRTA0QjAwNEIyMDRCNDA0QjYwNEI4MDRCQTA0QkMwNEJFMDRDMDA0QzEwNEMzMDRDNTA0QzcwNEM5MDRDQjA0Q0QwNEQwMDREMjA0RDQwNEQ2MDREODA0REEwNERDMDRERTA0RTAwNEUyMDRFNDA0RTYwNEU4MDRFQTA0RUMwNEVFMDRGMDA0RjIwNEY0MDRGNjA0RjgwNEZBMDRGQzA0RkUwNTAwMDUwMjA1MDQwNTA2MDUwODA1MEEwNTBDMDUwRTA1MTAwNTEyMDUxNDA1MTYwNTE4MDUxQTA1MUMwNTFFMDUyMDA1MjIwNTI0MDUyNjA1MzEtMDU1NjEwQTAtMTBDNTEwQzcxMENEMUUwMDFFMDIxRTA0MUUwNjFFMDgxRTBBMUUwQzFFMEUxRTEwMUUxMjFFMTQxRTE2MUUxODFFMUExRTFDMUUxRTFFMjAxRTIyMUUyNDFFMjYxRTI4MUUyQTFFMkMxRTJFMUUzMDFFMzIxRTM0MUUzNjFFMzgxRTNBMUUzQzFFM0UxRTQwMUU0MjFFNDQxRTQ2MUU0ODFFNEExRTRDMUU0RTFFNTAxRTUyMUU1NDFFNTYxRTU4MUU1QTFFNUMxRTVFMUU2MDFFNjIxRTY0MUU2NjFFNjgxRTZBMUU2QzFFNkUxRTcwMUU3MjFFNzQxRTc2MUU3ODFFN0ExRTdDMUU3RTFFODAxRTgyMUU4NDFFODYxRTg4MUU4QTFFOEMxRThFMUU5MDFFOTIxRTk0MUU5RTFFQTAxRUEyMUVBNDFFQTYxRUE4MUVBQTFFQUMxRUFFMUVCMDFFQjIxRUI0MUVCNjFFQjgxRUJBMUVCQzFFQkUxRUMwMUVDMjFFQzQxRUM2MUVDODFFQ0ExRUNDMUVDRTFFRDAxRUQyMUVENDFFRDYxRUQ4MUVEQTFFREMxRURFMUVFMDFFRTIxRUU0MUVFNjFFRTgxRUVBMUVFQzFFRUUxRUYwMUVGMjFFRjQxRUY2MUVGODFFRkExRUZDMUVGRTFGMDgtMUYwRjFGMTgtMUYxRDFGMjgtMUYyRjFGMzgtMUYzRjFGNDgtMUY0RDFGNTkxRjVCMUY1RDFGNUYxRjY4LTFGNkYxRkI4LTFGQkIxRkM4LTFGQ0IxRkQ4LTFGREIxRkU4LTFGRUMxRkY4LTFGRkIyMTAyMjEwNzIxMEItMjEwRDIxMTAtMjExMjIxMTUyMTE5LTIxMUQyMTI0MjEyNjIxMjgyMTJBLTIxMkQyMTMwLTIxMzMyMTNFMjEzRjIxNDUyMTgzMkMwMC0yQzJFMkM2MDJDNjItMkM2NDJDNjcyQzY5MkM2QjJDNkQtMkM3MDJDNzIyQzc1MkM3RS0yQzgwMkM4MjJDODQyQzg2MkM4ODJDOEEyQzhDMkM4RTJDOTAyQzkyMkM5NDJDOTYyQzk4MkM5QTJDOUMyQzlFMkNBMDJDQTIyQ0E0MkNBNjJDQTgyQ0FBMkNBQzJDQUUyQ0IwMkNCMjJDQjQyQ0I2MkNCODJDQkEyQ0JDMkNCRTJDQzAyQ0MyMkNDNDJDQzYyQ0M4MkNDQTJDQ0MyQ0NFMkNEMDJDRDIyQ0Q0MkNENjJDRDgyQ0RBMkNEQzJDREUyQ0UwMkNFMjJDRUIyQ0VEMkNGMkE2NDBBNjQyQTY0NEE2NDZBNjQ4QTY0QUE2NENBNjRFQTY1MEE2NTJBNjU0QTY1NkE2NThBNjVBQTY1Q0E2NUVBNjYwQTY2MkE2NjRBNjY2QTY2OEE2NkFBNjZDQTY4MEE2ODJBNjg0QTY4NkE2ODhBNjhBQTY4Q0E2OEVBNjkwQTY5MkE2OTRBNjk2QTcyMkE3MjRBNzI2QTcyOEE3MkFBNzJDQTcyRUE3MzJBNzM0QTczNkE3MzhBNzNBQTczQ0E3M0VBNzQwQTc0MkE3NDRBNzQ2QTc0OEE3NEFBNzRDQTc0RUE3NTBBNzUyQTc1NEE3NTZBNzU4QTc1QUE3NUNBNzVFQTc2MEE3NjJBNzY0QTc2NkE3NjhBNzZBQTc2Q0E3NkVBNzc5QTc3QkE3N0RBNzdFQTc4MEE3ODJBNzg0QTc4NkE3OEJBNzhEQTc5MEE3OTJBN0EwQTdBMkE3QTRBN0E2QTdBOEE3QUFGRjIxLUZGM0FcIixcclxuICAgICAgICBMdDogXCIwMUM1MDFDODAxQ0IwMUYyMUY4OC0xRjhGMUY5OC0xRjlGMUZBOC0xRkFGMUZCQzFGQ0MxRkZDXCIsXHJcbiAgICAgICAgTG06IFwiMDJCMC0wMkMxMDJDNi0wMkQxMDJFMC0wMkU0MDJFQzAyRUUwMzc0MDM3QTA1NTkwNjQwMDZFNTA2RTYwN0Y0MDdGNTA3RkEwODFBMDgyNDA4MjgwOTcxMEU0NjBFQzYxMEZDMTdENzE4NDMxQUE3MUM3OC0xQzdEMUQyQy0xRDZBMUQ3ODFEOUItMURCRjIwNzEyMDdGMjA5MC0yMDlDMkM3QzJDN0QyRDZGMkUyRjMwMDUzMDMxLTMwMzUzMDNCMzA5RDMwOUUzMEZDLTMwRkVBMDE1QTRGOC1BNEZEQTYwQ0E2N0ZBNzE3LUE3MUZBNzcwQTc4OEE3RjhBN0Y5QTlDRkFBNzBBQUREQUFGM0FBRjRGRjcwRkY5RUZGOUZcIixcclxuICAgICAgICBMbzogXCIwMEFBMDBCQTAxQkIwMUMwLTAxQzMwMjk0MDVEMC0wNUVBMDVGMC0wNUYyMDYyMC0wNjNGMDY0MS0wNjRBMDY2RTA2NkYwNjcxLTA2RDMwNkQ1MDZFRTA2RUYwNkZBLTA2RkMwNkZGMDcxMDA3MTItMDcyRjA3NEQtMDdBNTA3QjEwN0NBLTA3RUEwODAwLTA4MTUwODQwLTA4NTgwOEEwMDhBMi0wOEFDMDkwNC0wOTM5MDkzRDA5NTAwOTU4LTA5NjEwOTcyLTA5NzcwOTc5LTA5N0YwOTg1LTA5OEMwOThGMDk5MDA5OTMtMDlBODA5QUEtMDlCMDA5QjIwOUI2LTA5QjkwOUJEMDlDRTA5REMwOUREMDlERi0wOUUxMDlGMDA5RjEwQTA1LTBBMEEwQTBGMEExMDBBMTMtMEEyODBBMkEtMEEzMDBBMzIwQTMzMEEzNTBBMzYwQTM4MEEzOTBBNTktMEE1QzBBNUUwQTcyLTBBNzQwQTg1LTBBOEQwQThGLTBBOTEwQTkzLTBBQTgwQUFBLTBBQjAwQUIyMEFCMzBBQjUtMEFCOTBBQkQwQUQwMEFFMDBBRTEwQjA1LTBCMEMwQjBGMEIxMDBCMTMtMEIyODBCMkEtMEIzMDBCMzIwQjMzMEIzNS0wQjM5MEIzRDBCNUMwQjVEMEI1Ri0wQjYxMEI3MTBCODMwQjg1LTBCOEEwQjhFLTBCOTAwQjkyLTBCOTUwQjk5MEI5QTBCOUMwQjlFMEI5RjBCQTMwQkE0MEJBOC0wQkFBMEJBRS0wQkI5MEJEMDBDMDUtMEMwQzBDMEUtMEMxMDBDMTItMEMyODBDMkEtMEMzMzBDMzUtMEMzOTBDM0QwQzU4MEM1OTBDNjAwQzYxMEM4NS0wQzhDMEM4RS0wQzkwMEM5Mi0wQ0E4MENBQS0wQ0IzMENCNS0wQ0I5MENCRDBDREUwQ0UwMENFMTBDRjEwQ0YyMEQwNS0wRDBDMEQwRS0wRDEwMEQxMi0wRDNBMEQzRDBENEUwRDYwMEQ2MTBEN0EtMEQ3RjBEODUtMEQ5NjBEOUEtMERCMTBEQjMtMERCQjBEQkQwREMwLTBEQzYwRTAxLTBFMzAwRTMyMEUzMzBFNDAtMEU0NTBFODEwRTgyMEU4NDBFODcwRTg4MEU4QTBFOEQwRTk0LTBFOTcwRTk5LTBFOUYwRUExLTBFQTMwRUE1MEVBNzBFQUEwRUFCMEVBRC0wRUIwMEVCMjBFQjMwRUJEMEVDMC0wRUM0MEVEQy0wRURGMEYwMDBGNDAtMEY0NzBGNDktMEY2QzBGODgtMEY4QzEwMDAtMTAyQTEwM0YxMDUwLTEwNTUxMDVBLTEwNUQxMDYxMTA2NTEwNjYxMDZFLTEwNzAxMDc1LTEwODExMDhFMTBEMC0xMEZBMTBGRC0xMjQ4MTI0QS0xMjREMTI1MC0xMjU2MTI1ODEyNUEtMTI1RDEyNjAtMTI4ODEyOEEtMTI4RDEyOTAtMTJCMDEyQjItMTJCNTEyQjgtMTJCRTEyQzAxMkMyLTEyQzUxMkM4LTEyRDYxMkQ4LTEzMTAxMzEyLTEzMTUxMzE4LTEzNUExMzgwLTEzOEYxM0EwLTEzRjQxNDAxLTE2NkMxNjZGLTE2N0YxNjgxLTE2OUExNkEwLTE2RUExNzAwLTE3MEMxNzBFLTE3MTExNzIwLTE3MzExNzQwLTE3NTExNzYwLTE3NkMxNzZFLTE3NzAxNzgwLTE3QjMxN0RDMTgyMC0xODQyMTg0NC0xODc3MTg4MC0xOEE4MThBQTE4QjAtMThGNTE5MDAtMTkxQzE5NTAtMTk2RDE5NzAtMTk3NDE5ODAtMTlBQjE5QzEtMTlDNzFBMDAtMUExNjFBMjAtMUE1NDFCMDUtMUIzMzFCNDUtMUI0QjFCODMtMUJBMDFCQUUxQkFGMUJCQS0xQkU1MUMwMC0xQzIzMUM0RC0xQzRGMUM1QS0xQzc3MUNFOS0xQ0VDMUNFRS0xQ0YxMUNGNTFDRjYyMTM1LTIxMzgyRDMwLTJENjcyRDgwLTJEOTYyREEwLTJEQTYyREE4LTJEQUUyREIwLTJEQjYyREI4LTJEQkUyREMwLTJEQzYyREM4LTJEQ0UyREQwLTJERDYyREQ4LTJEREUzMDA2MzAzQzMwNDEtMzA5NjMwOUYzMEExLTMwRkEzMEZGMzEwNS0zMTJEMzEzMS0zMThFMzFBMC0zMUJBMzFGMC0zMUZGMzQwMC00REI1NEUwMC05RkNDQTAwMC1BMDE0QTAxNi1BNDhDQTREMC1BNEY3QTUwMC1BNjBCQTYxMC1BNjFGQTYyQUE2MkJBNjZFQTZBMC1BNkU1QTdGQi1BODAxQTgwMy1BODA1QTgwNy1BODBBQTgwQy1BODIyQTg0MC1BODczQTg4Mi1BOEIzQThGMi1BOEY3QThGQkE5MEEtQTkyNUE5MzAtQTk0NkE5NjAtQTk3Q0E5ODQtQTlCMkFBMDAtQUEyOEFBNDAtQUE0MkFBNDQtQUE0QkFBNjAtQUE2RkFBNzEtQUE3NkFBN0FBQTgwLUFBQUZBQUIxQUFCNUFBQjZBQUI5LUFBQkRBQUMwQUFDMkFBREJBQURDQUFFMC1BQUVBQUFGMkFCMDEtQUIwNkFCMDktQUIwRUFCMTEtQUIxNkFCMjAtQUIyNkFCMjgtQUIyRUFCQzAtQUJFMkFDMDAtRDdBM0Q3QjAtRDdDNkQ3Q0ItRDdGQkY5MDAtRkE2REZBNzAtRkFEOUZCMURGQjFGLUZCMjhGQjJBLUZCMzZGQjM4LUZCM0NGQjNFRkI0MEZCNDFGQjQzRkI0NEZCNDYtRkJCMUZCRDMtRkQzREZENTAtRkQ4RkZEOTItRkRDN0ZERjAtRkRGQkZFNzAtRkU3NEZFNzYtRkVGQ0ZGNjYtRkY2RkZGNzEtRkY5REZGQTAtRkZCRUZGQzItRkZDN0ZGQ0EtRkZDRkZGRDItRkZEN0ZGREEtRkZEQ1wiLFxyXG4gICAgICAgIE06IFwiMDMwMC0wMzZGMDQ4My0wNDg5MDU5MS0wNUJEMDVCRjA1QzEwNUMyMDVDNDA1QzUwNUM3MDYxMC0wNjFBMDY0Qi0wNjVGMDY3MDA2RDYtMDZEQzA2REYtMDZFNDA2RTcwNkU4MDZFQS0wNkVEMDcxMTA3MzAtMDc0QTA3QTYtMDdCMDA3RUItMDdGMzA4MTYtMDgxOTA4MUItMDgyMzA4MjUtMDgyNzA4MjktMDgyRDA4NTktMDg1QjA4RTQtMDhGRTA5MDAtMDkwMzA5M0EtMDkzQzA5M0UtMDk0RjA5NTEtMDk1NzA5NjIwOTYzMDk4MS0wOTgzMDlCQzA5QkUtMDlDNDA5QzcwOUM4MDlDQi0wOUNEMDlENzA5RTIwOUUzMEEwMS0wQTAzMEEzQzBBM0UtMEE0MjBBNDcwQTQ4MEE0Qi0wQTREMEE1MTBBNzAwQTcxMEE3NTBBODEtMEE4MzBBQkMwQUJFLTBBQzUwQUM3LTBBQzkwQUNCLTBBQ0QwQUUyMEFFMzBCMDEtMEIwMzBCM0MwQjNFLTBCNDQwQjQ3MEI0ODBCNEItMEI0RDBCNTYwQjU3MEI2MjBCNjMwQjgyMEJCRS0wQkMyMEJDNi0wQkM4MEJDQS0wQkNEMEJENzBDMDEtMEMwMzBDM0UtMEM0NDBDNDYtMEM0ODBDNEEtMEM0RDBDNTUwQzU2MEM2MjBDNjMwQzgyMEM4MzBDQkMwQ0JFLTBDQzQwQ0M2LTBDQzgwQ0NBLTBDQ0QwQ0Q1MENENjBDRTIwQ0UzMEQwMjBEMDMwRDNFLTBENDQwRDQ2LTBENDgwRDRBLTBENEQwRDU3MEQ2MjBENjMwRDgyMEQ4MzBEQ0EwRENGLTBERDQwREQ2MEREOC0wRERGMERGMjBERjMwRTMxMEUzNC0wRTNBMEU0Ny0wRTRFMEVCMTBFQjQtMEVCOTBFQkIwRUJDMEVDOC0wRUNEMEYxODBGMTkwRjM1MEYzNzBGMzkwRjNFMEYzRjBGNzEtMEY4NDBGODYwRjg3MEY4RC0wRjk3MEY5OS0wRkJDMEZDNjEwMkItMTAzRTEwNTYtMTA1OTEwNUUtMTA2MDEwNjItMTA2NDEwNjctMTA2RDEwNzEtMTA3NDEwODItMTA4RDEwOEYxMDlBLTEwOUQxMzVELTEzNUYxNzEyLTE3MTQxNzMyLTE3MzQxNzUyMTc1MzE3NzIxNzczMTdCNC0xN0QzMTdERDE4MEItMTgwRDE4QTkxOTIwLTE5MkIxOTMwLTE5M0IxOUIwLTE5QzAxOUM4MTlDOTFBMTctMUExQjFBNTUtMUE1RTFBNjAtMUE3QzFBN0YxQjAwLTFCMDQxQjM0LTFCNDQxQjZCLTFCNzMxQjgwLTFCODIxQkExLTFCQUQxQkU2LTFCRjMxQzI0LTFDMzcxQ0QwLTFDRDIxQ0Q0LTFDRTgxQ0VEMUNGMi0xQ0Y0MURDMC0xREU2MURGQy0xREZGMjBEMC0yMEYwMkNFRi0yQ0YxMkQ3RjJERTAtMkRGRjMwMkEtMzAyRjMwOTkzMDlBQTY2Ri1BNjcyQTY3NC1BNjdEQTY5RkE2RjBBNkYxQTgwMkE4MDZBODBCQTgyMy1BODI3QTg4MEE4ODFBOEI0LUE4QzRBOEUwLUE4RjFBOTI2LUE5MkRBOTQ3LUE5NTNBOTgwLUE5ODNBOUIzLUE5QzBBQTI5LUFBMzZBQTQzQUE0Q0FBNERBQTdCQUFCMEFBQjItQUFCNEFBQjdBQUI4QUFCRUFBQkZBQUMxQUFFQi1BQUVGQUFGNUFBRjZBQkUzLUFCRUFBQkVDQUJFREZCMUVGRTAwLUZFMEZGRTIwLUZFMjZcIixcclxuICAgICAgICBNbjogXCIwMzAwLTAzNkYwNDgzLTA0ODcwNTkxLTA1QkQwNUJGMDVDMTA1QzIwNUM0MDVDNTA1QzcwNjEwLTA2MUEwNjRCLTA2NUYwNjcwMDZENi0wNkRDMDZERi0wNkU0MDZFNzA2RTgwNkVBLTA2RUQwNzExMDczMC0wNzRBMDdBNi0wN0IwMDdFQi0wN0YzMDgxNi0wODE5MDgxQi0wODIzMDgyNS0wODI3MDgyOS0wODJEMDg1OS0wODVCMDhFNC0wOEZFMDkwMC0wOTAyMDkzQTA5M0MwOTQxLTA5NDgwOTREMDk1MS0wOTU3MDk2MjA5NjMwOTgxMDlCQzA5QzEtMDlDNDA5Q0QwOUUyMDlFMzBBMDEwQTAyMEEzQzBBNDEwQTQyMEE0NzBBNDgwQTRCLTBBNEQwQTUxMEE3MDBBNzEwQTc1MEE4MTBBODIwQUJDMEFDMS0wQUM1MEFDNzBBQzgwQUNEMEFFMjBBRTMwQjAxMEIzQzBCM0YwQjQxLTBCNDQwQjREMEI1NjBCNjIwQjYzMEI4MjBCQzAwQkNEMEMzRS0wQzQwMEM0Ni0wQzQ4MEM0QS0wQzREMEM1NTBDNTYwQzYyMEM2MzBDQkMwQ0JGMENDNjBDQ0MwQ0NEMENFMjBDRTMwRDQxLTBENDQwRDREMEQ2MjBENjMwRENBMEREMi0wREQ0MERENjBFMzEwRTM0LTBFM0EwRTQ3LTBFNEUwRUIxMEVCNC0wRUI5MEVCQjBFQkMwRUM4LTBFQ0QwRjE4MEYxOTBGMzUwRjM3MEYzOTBGNzEtMEY3RTBGODAtMEY4NDBGODYwRjg3MEY4RC0wRjk3MEY5OS0wRkJDMEZDNjEwMkQtMTAzMDEwMzItMTAzNzEwMzkxMDNBMTAzRDEwM0UxMDU4MTA1OTEwNUUtMTA2MDEwNzEtMTA3NDEwODIxMDg1MTA4NjEwOEQxMDlEMTM1RC0xMzVGMTcxMi0xNzE0MTczMi0xNzM0MTc1MjE3NTMxNzcyMTc3MzE3QjQxN0I1MTdCNy0xN0JEMTdDNjE3QzktMTdEMzE3REQxODBCLTE4MEQxOEE5MTkyMC0xOTIyMTkyNzE5MjgxOTMyMTkzOS0xOTNCMUExNzFBMTgxQTU2MUE1OC0xQTVFMUE2MDFBNjIxQTY1LTFBNkMxQTczLTFBN0MxQTdGMUIwMC0xQjAzMUIzNDFCMzYtMUIzQTFCM0MxQjQyMUI2Qi0xQjczMUI4MDFCODExQkEyLTFCQTUxQkE4MUJBOTFCQUIxQkU2MUJFODFCRTkxQkVEMUJFRi0xQkYxMUMyQy0xQzMzMUMzNjFDMzcxQ0QwLTFDRDIxQ0Q0LTFDRTAxQ0UyLTFDRTgxQ0VEMUNGNDFEQzAtMURFNjFERkMtMURGRjIwRDAtMjBEQzIwRTEyMEU1LTIwRjAyQ0VGLTJDRjEyRDdGMkRFMC0yREZGMzAyQS0zMDJEMzA5OTMwOUFBNjZGQTY3NC1BNjdEQTY5RkE2RjBBNkYxQTgwMkE4MDZBODBCQTgyNUE4MjZBOEM0QThFMC1BOEYxQTkyNi1BOTJEQTk0Ny1BOTUxQTk4MC1BOTgyQTlCM0E5QjYtQTlCOUE5QkNBQTI5LUFBMkVBQTMxQUEzMkFBMzVBQTM2QUE0M0FBNENBQUIwQUFCMi1BQUI0QUFCN0FBQjhBQUJFQUFCRkFBQzFBQUVDQUFFREFBRjZBQkU1QUJFOEFCRURGQjFFRkUwMC1GRTBGRkUyMC1GRTI2XCIsXHJcbiAgICAgICAgTWM6IFwiMDkwMzA5M0IwOTNFLTA5NDAwOTQ5LTA5NEMwOTRFMDk0RjA5ODIwOTgzMDlCRS0wOUMwMDlDNzA5QzgwOUNCMDlDQzA5RDcwQTAzMEEzRS0wQTQwMEE4MzBBQkUtMEFDMDBBQzkwQUNCMEFDQzBCMDIwQjAzMEIzRTBCNDAwQjQ3MEI0ODBCNEIwQjRDMEI1NzBCQkUwQkJGMEJDMTBCQzIwQkM2LTBCQzgwQkNBLTBCQ0MwQkQ3MEMwMS0wQzAzMEM0MS0wQzQ0MEM4MjBDODMwQ0JFMENDMC0wQ0M0MENDNzBDQzgwQ0NBMENDQjBDRDUwQ0Q2MEQwMjBEMDMwRDNFLTBENDAwRDQ2LTBENDgwRDRBLTBENEMwRDU3MEQ4MjBEODMwRENGLTBERDEwREQ4LTBEREYwREYyMERGMzBGM0UwRjNGMEY3RjEwMkIxMDJDMTAzMTEwMzgxMDNCMTAzQzEwNTYxMDU3MTA2Mi0xMDY0MTA2Ny0xMDZEMTA4MzEwODQxMDg3LTEwOEMxMDhGMTA5QS0xMDlDMTdCNjE3QkUtMTdDNTE3QzcxN0M4MTkyMy0xOTI2MTkyOS0xOTJCMTkzMDE5MzExOTMzLTE5MzgxOUIwLTE5QzAxOUM4MTlDOTFBMTktMUExQjFBNTUxQTU3MUE2MTFBNjMxQTY0MUE2RC0xQTcyMUIwNDFCMzUxQjNCMUIzRC0xQjQxMUI0MzFCNDQxQjgyMUJBMTFCQTYxQkE3MUJBQTFCQUMxQkFEMUJFNzFCRUEtMUJFQzFCRUUxQkYyMUJGMzFDMjQtMUMyQjFDMzQxQzM1MUNFMTFDRjIxQ0YzMzAyRTMwMkZBODIzQTgyNEE4MjdBODgwQTg4MUE4QjQtQThDM0E5NTJBOTUzQTk4M0E5QjRBOUI1QTlCQUE5QkJBOUJELUE5QzBBQTJGQUEzMEFBMzNBQTM0QUE0REFBN0JBQUVCQUFFRUFBRUZBQUY1QUJFM0FCRTRBQkU2QUJFN0FCRTlBQkVBQUJFQ1wiLFxyXG4gICAgICAgIE1lOiBcIjA0ODgwNDg5MjBERC0yMEUwMjBFMi0yMEU0QTY3MC1BNjcyXCIsXHJcbiAgICAgICAgTjogXCIwMDMwLTAwMzkwMEIyMDBCMzAwQjkwMEJDLTAwQkUwNjYwLTA2NjkwNkYwLTA2RjkwN0MwLTA3QzkwOTY2LTA5NkYwOUU2LTA5RUYwOUY0LTA5RjkwQTY2LTBBNkYwQUU2LTBBRUYwQjY2LTBCNkYwQjcyLTBCNzcwQkU2LTBCRjIwQzY2LTBDNkYwQzc4LTBDN0UwQ0U2LTBDRUYwRDY2LTBENzUwRTUwLTBFNTkwRUQwLTBFRDkwRjIwLTBGMzMxMDQwLTEwNDkxMDkwLTEwOTkxMzY5LTEzN0MxNkVFLTE2RjAxN0UwLTE3RTkxN0YwLTE3RjkxODEwLTE4MTkxOTQ2LTE5NEYxOUQwLTE5REExQTgwLTFBODkxQTkwLTFBOTkxQjUwLTFCNTkxQkIwLTFCQjkxQzQwLTFDNDkxQzUwLTFDNTkyMDcwMjA3NC0yMDc5MjA4MC0yMDg5MjE1MC0yMTgyMjE4NS0yMTg5MjQ2MC0yNDlCMjRFQS0yNEZGMjc3Ni0yNzkzMkNGRDMwMDczMDIxLTMwMjkzMDM4LTMwM0EzMTkyLTMxOTUzMjIwLTMyMjkzMjQ4LTMyNEYzMjUxLTMyNUYzMjgwLTMyODkzMkIxLTMyQkZBNjIwLUE2MjlBNkU2LUE2RUZBODMwLUE4MzVBOEQwLUE4RDlBOTAwLUE5MDlBOUQwLUE5RDlBQTUwLUFBNTlBQkYwLUFCRjlGRjEwLUZGMTlcIixcclxuICAgICAgICBOZDogXCIwMDMwLTAwMzkwNjYwLTA2NjkwNkYwLTA2RjkwN0MwLTA3QzkwOTY2LTA5NkYwOUU2LTA5RUYwQTY2LTBBNkYwQUU2LTBBRUYwQjY2LTBCNkYwQkU2LTBCRUYwQzY2LTBDNkYwQ0U2LTBDRUYwRDY2LTBENkYwRTUwLTBFNTkwRUQwLTBFRDkwRjIwLTBGMjkxMDQwLTEwNDkxMDkwLTEwOTkxN0UwLTE3RTkxODEwLTE4MTkxOTQ2LTE5NEYxOUQwLTE5RDkxQTgwLTFBODkxQTkwLTFBOTkxQjUwLTFCNTkxQkIwLTFCQjkxQzQwLTFDNDkxQzUwLTFDNTlBNjIwLUE2MjlBOEQwLUE4RDlBOTAwLUE5MDlBOUQwLUE5RDlBQTUwLUFBNTlBQkYwLUFCRjlGRjEwLUZGMTlcIixcclxuICAgICAgICBObDogXCIxNkVFLTE2RjAyMTYwLTIxODIyMTg1LTIxODgzMDA3MzAyMS0zMDI5MzAzOC0zMDNBQTZFNi1BNkVGXCIsXHJcbiAgICAgICAgTm86IFwiMDBCMjAwQjMwMEI5MDBCQy0wMEJFMDlGNC0wOUY5MEI3Mi0wQjc3MEJGMC0wQkYyMEM3OC0wQzdFMEQ3MC0wRDc1MEYyQS0wRjMzMTM2OS0xMzdDMTdGMC0xN0Y5MTlEQTIwNzAyMDc0LTIwNzkyMDgwLTIwODkyMTUwLTIxNUYyMTg5MjQ2MC0yNDlCMjRFQS0yNEZGMjc3Ni0yNzkzMkNGRDMxOTItMzE5NTMyMjAtMzIyOTMyNDgtMzI0RjMyNTEtMzI1RjMyODAtMzI4OTMyQjEtMzJCRkE4MzAtQTgzNVwiLFxyXG4gICAgICAgIFA6IFwiMDAyMS0wMDIzMDAyNS0wMDJBMDAyQy0wMDJGMDAzQTAwM0IwMDNGMDA0MDAwNUItMDA1RDAwNUYwMDdCMDA3RDAwQTEwMEE3MDBBQjAwQjYwMEI3MDBCQjAwQkYwMzdFMDM4NzA1NUEtMDU1RjA1ODkwNThBMDVCRTA1QzAwNUMzMDVDNjA1RjMwNUY0MDYwOTA2MEEwNjBDMDYwRDA2MUIwNjFFMDYxRjA2NkEtMDY2RDA2RDQwNzAwLTA3MEQwN0Y3LTA3RjkwODMwLTA4M0UwODVFMDk2NDA5NjUwOTcwMEFGMDBERjQwRTRGMEU1QTBFNUIwRjA0LTBGMTIwRjE0MEYzQS0wRjNEMEY4NTBGRDAtMEZENDBGRDkwRkRBMTA0QS0xMDRGMTBGQjEzNjAtMTM2ODE0MDAxNjZEMTY2RTE2OUIxNjlDMTZFQi0xNkVEMTczNTE3MzYxN0Q0LTE3RDYxN0Q4LTE3REExODAwLTE4MEExOTQ0MTk0NTFBMUUxQTFGMUFBMC0xQUE2MUFBOC0xQUFEMUI1QS0xQjYwMUJGQy0xQkZGMUMzQi0xQzNGMUM3RTFDN0YxQ0MwLTFDQzcxQ0QzMjAxMC0yMDI3MjAzMC0yMDQzMjA0NS0yMDUxMjA1My0yMDVFMjA3RDIwN0UyMDhEMjA4RTIzMjkyMzJBMjc2OC0yNzc1MjdDNTI3QzYyN0U2LTI3RUYyOTgzLTI5OTgyOUQ4LTI5REIyOUZDMjlGRDJDRjktMkNGQzJDRkUyQ0ZGMkQ3MDJFMDAtMkUyRTJFMzAtMkUzQjMwMDEtMzAwMzMwMDgtMzAxMTMwMTQtMzAxRjMwMzAzMDNEMzBBMDMwRkJBNEZFQTRGRkE2MEQtQTYwRkE2NzNBNjdFQTZGMi1BNkY3QTg3NC1BODc3QThDRUE4Q0ZBOEY4LUE4RkFBOTJFQTkyRkE5NUZBOUMxLUE5Q0RBOURFQTlERkFBNUMtQUE1RkFBREVBQURGQUFGMEFBRjFBQkVCRkQzRUZEM0ZGRTEwLUZFMTlGRTMwLUZFNTJGRTU0LUZFNjFGRTYzRkU2OEZFNkFGRTZCRkYwMS1GRjAzRkYwNS1GRjBBRkYwQy1GRjBGRkYxQUZGMUJGRjFGRkYyMEZGM0ItRkYzREZGM0ZGRjVCRkY1REZGNUYtRkY2NVwiLFxyXG4gICAgICAgIFBkOiBcIjAwMkQwNThBMDVCRTE0MDAxODA2MjAxMC0yMDE1MkUxNzJFMUEyRTNBMkUzQjMwMUMzMDMwMzBBMEZFMzFGRTMyRkU1OEZFNjNGRjBEXCIsXHJcbiAgICAgICAgUHM6IFwiMDAyODAwNUIwMDdCMEYzQTBGM0MxNjlCMjAxQTIwMUUyMDQ1MjA3RDIwOEQyMzI5Mjc2ODI3NkEyNzZDMjc2RTI3NzAyNzcyMjc3NDI3QzUyN0U2MjdFODI3RUEyN0VDMjdFRTI5ODMyOTg1Mjk4NzI5ODkyOThCMjk4RDI5OEYyOTkxMjk5MzI5OTUyOTk3MjlEODI5REEyOUZDMkUyMjJFMjQyRTI2MkUyODMwMDgzMDBBMzAwQzMwMEUzMDEwMzAxNDMwMTYzMDE4MzAxQTMwMURGRDNFRkUxN0ZFMzVGRTM3RkUzOUZFM0JGRTNERkUzRkZFNDFGRTQzRkU0N0ZFNTlGRTVCRkU1REZGMDhGRjNCRkY1QkZGNUZGRjYyXCIsXHJcbiAgICAgICAgUGU6IFwiMDAyOTAwNUQwMDdEMEYzQjBGM0QxNjlDMjA0NjIwN0UyMDhFMjMyQTI3NjkyNzZCMjc2RDI3NkYyNzcxMjc3MzI3NzUyN0M2MjdFNzI3RTkyN0VCMjdFRDI3RUYyOTg0Mjk4NjI5ODgyOThBMjk4QzI5OEUyOTkwMjk5MjI5OTQyOTk2Mjk5ODI5RDkyOURCMjlGRDJFMjMyRTI1MkUyNzJFMjkzMDA5MzAwQjMwMEQzMDBGMzAxMTMwMTUzMDE3MzAxOTMwMUIzMDFFMzAxRkZEM0ZGRTE4RkUzNkZFMzhGRTNBRkUzQ0ZFM0VGRTQwRkU0MkZFNDRGRTQ4RkU1QUZFNUNGRTVFRkYwOUZGM0RGRjVERkY2MEZGNjNcIixcclxuICAgICAgICBQaTogXCIwMEFCMjAxODIwMUIyMDFDMjAxRjIwMzkyRTAyMkUwNDJFMDkyRTBDMkUxQzJFMjBcIixcclxuICAgICAgICBQZjogXCIwMEJCMjAxOTIwMUQyMDNBMkUwMzJFMDUyRTBBMkUwRDJFMUQyRTIxXCIsXHJcbiAgICAgICAgUGM6IFwiMDA1RjIwM0YyMDQwMjA1NEZFMzNGRTM0RkU0RC1GRTRGRkYzRlwiLFxyXG4gICAgICAgIFBvOiBcIjAwMjEtMDAyMzAwMjUtMDAyNzAwMkEwMDJDMDAyRTAwMkYwMDNBMDAzQjAwM0YwMDQwMDA1QzAwQTEwMEE3MDBCNjAwQjcwMEJGMDM3RTAzODcwNTVBLTA1NUYwNTg5MDVDMDA1QzMwNUM2MDVGMzA1RjQwNjA5MDYwQTA2MEMwNjBEMDYxQjA2MUUwNjFGMDY2QS0wNjZEMDZENDA3MDAtMDcwRDA3RjctMDdGOTA4MzAtMDgzRTA4NUUwOTY0MDk2NTA5NzAwQUYwMERGNDBFNEYwRTVBMEU1QjBGMDQtMEYxMjBGMTQwRjg1MEZEMC0wRkQ0MEZEOTBGREExMDRBLTEwNEYxMEZCMTM2MC0xMzY4MTY2RDE2NkUxNkVCLTE2RUQxNzM1MTczNjE3RDQtMTdENjE3RDgtMTdEQTE4MDAtMTgwNTE4MDctMTgwQTE5NDQxOTQ1MUExRTFBMUYxQUEwLTFBQTYxQUE4LTFBQUQxQjVBLTFCNjAxQkZDLTFCRkYxQzNCLTFDM0YxQzdFMUM3RjFDQzAtMUNDNzFDRDMyMDE2MjAxNzIwMjAtMjAyNzIwMzAtMjAzODIwM0ItMjAzRTIwNDEtMjA0MzIwNDctMjA1MTIwNTMyMDU1LTIwNUUyQ0Y5LTJDRkMyQ0ZFMkNGRjJENzAyRTAwMkUwMTJFMDYtMkUwODJFMEIyRTBFLTJFMTYyRTE4MkUxOTJFMUIyRTFFMkUxRjJFMkEtMkUyRTJFMzAtMkUzOTMwMDEtMzAwMzMwM0QzMEZCQTRGRUE0RkZBNjBELUE2MEZBNjczQTY3RUE2RjItQTZGN0E4NzQtQTg3N0E4Q0VBOENGQThGOC1BOEZBQTkyRUE5MkZBOTVGQTlDMS1BOUNEQTlERUE5REZBQTVDLUFBNUZBQURFQUFERkFBRjBBQUYxQUJFQkZFMTAtRkUxNkZFMTlGRTMwRkU0NUZFNDZGRTQ5LUZFNENGRTUwLUZFNTJGRTU0LUZFNTdGRTVGLUZFNjFGRTY4RkU2QUZFNkJGRjAxLUZGMDNGRjA1LUZGMDdGRjBBRkYwQ0ZGMEVGRjBGRkYxQUZGMUJGRjFGRkYyMEZGM0NGRjYxRkY2NEZGNjVcIixcclxuICAgICAgICBTOiBcIjAwMjQwMDJCMDAzQy0wMDNFMDA1RTAwNjAwMDdDMDA3RTAwQTItMDBBNjAwQTgwMEE5MDBBQzAwQUUtMDBCMTAwQjQwMEI4MDBENzAwRjcwMkMyLTAyQzUwMkQyLTAyREYwMkU1LTAyRUIwMkVEMDJFRi0wMkZGMDM3NTAzODQwMzg1MDNGNjA0ODIwNThGMDYwNi0wNjA4MDYwQjA2MEUwNjBGMDZERTA2RTkwNkZEMDZGRTA3RjYwOUYyMDlGMzA5RkEwOUZCMEFGMTBCNzAwQkYzLTBCRkEwQzdGMEQ3OTBFM0YwRjAxLTBGMDMwRjEzMEYxNS0wRjE3MEYxQS0wRjFGMEYzNDBGMzYwRjM4MEZCRS0wRkM1MEZDNy0wRkNDMEZDRTBGQ0YwRkQ1LTBGRDgxMDlFMTA5RjEzOTAtMTM5OTE3REIxOTQwMTlERS0xOUZGMUI2MS0xQjZBMUI3NC0xQjdDMUZCRDFGQkYtMUZDMTFGQ0QtMUZDRjFGREQtMUZERjFGRUQtMUZFRjFGRkQxRkZFMjA0NDIwNTIyMDdBLTIwN0MyMDhBLTIwOEMyMEEwLTIwQjkyMTAwMjEwMTIxMDMtMjEwNjIxMDgyMTA5MjExNDIxMTYtMjExODIxMUUtMjEyMzIxMjUyMTI3MjEyOTIxMkUyMTNBMjEzQjIxNDAtMjE0NDIxNEEtMjE0RDIxNEYyMTkwLTIzMjgyMzJCLTIzRjMyNDAwLTI0MjYyNDQwLTI0NEEyNDlDLTI0RTkyNTAwLTI2RkYyNzAxLTI3NjcyNzk0LTI3QzQyN0M3LTI3RTUyN0YwLTI5ODIyOTk5LTI5RDcyOURDLTI5RkIyOUZFLTJCNEMyQjUwLTJCNTkyQ0U1LTJDRUEyRTgwLTJFOTkyRTlCLTJFRjMyRjAwLTJGRDUyRkYwLTJGRkIzMDA0MzAxMjMwMTMzMDIwMzAzNjMwMzczMDNFMzAzRjMwOUIzMDlDMzE5MDMxOTEzMTk2LTMxOUYzMUMwLTMxRTMzMjAwLTMyMUUzMjJBLTMyNDczMjUwMzI2MC0zMjdGMzI4QS0zMkIwMzJDMC0zMkZFMzMwMC0zM0ZGNERDMC00REZGQTQ5MC1BNEM2QTcwMC1BNzE2QTcyMEE3MjFBNzg5QTc4QUE4MjgtQTgyQkE4MzYtQTgzOUFBNzctQUE3OUZCMjlGQkIyLUZCQzFGREZDRkRGREZFNjJGRTY0LUZFNjZGRTY5RkYwNEZGMEJGRjFDLUZGMUVGRjNFRkY0MEZGNUNGRjVFRkZFMC1GRkU2RkZFOC1GRkVFRkZGQ0ZGRkRcIixcclxuICAgICAgICBTbTogXCIwMDJCMDAzQy0wMDNFMDA3QzAwN0UwMEFDMDBCMTAwRDcwMEY3MDNGNjA2MDYtMDYwODIwNDQyMDUyMjA3QS0yMDdDMjA4QS0yMDhDMjExODIxNDAtMjE0NDIxNEIyMTkwLTIxOTQyMTlBMjE5QjIxQTAyMUEzMjFBNjIxQUUyMUNFMjFDRjIxRDIyMUQ0MjFGNC0yMkZGMjMwOC0yMzBCMjMyMDIzMjEyMzdDMjM5Qi0yM0IzMjNEQy0yM0UxMjVCNzI1QzEyNUY4LTI1RkYyNjZGMjdDMC0yN0M0MjdDNy0yN0U1MjdGMC0yN0ZGMjkwMC0yOTgyMjk5OS0yOUQ3MjlEQy0yOUZCMjlGRS0yQUZGMkIzMC0yQjQ0MkI0Ny0yQjRDRkIyOUZFNjJGRTY0LUZFNjZGRjBCRkYxQy1GRjFFRkY1Q0ZGNUVGRkUyRkZFOS1GRkVDXCIsXHJcbiAgICAgICAgU2M6IFwiMDAyNDAwQTItMDBBNTA1OEYwNjBCMDlGMjA5RjMwOUZCMEFGMTBCRjkwRTNGMTdEQjIwQTAtMjBCOUE4MzhGREZDRkU2OUZGMDRGRkUwRkZFMUZGRTVGRkU2XCIsXHJcbiAgICAgICAgU2s6IFwiMDA1RTAwNjAwMEE4MDBBRjAwQjQwMEI4MDJDMi0wMkM1MDJEMi0wMkRGMDJFNS0wMkVCMDJFRDAyRUYtMDJGRjAzNzUwMzg0MDM4NTFGQkQxRkJGLTFGQzExRkNELTFGQ0YxRkRELTFGREYxRkVELTFGRUYxRkZEMUZGRTMwOUIzMDlDQTcwMC1BNzE2QTcyMEE3MjFBNzg5QTc4QUZCQjItRkJDMUZGM0VGRjQwRkZFM1wiLFxyXG4gICAgICAgIFNvOiBcIjAwQTYwMEE5MDBBRTAwQjAwNDgyMDYwRTA2MEYwNkRFMDZFOTA2RkQwNkZFMDdGNjA5RkEwQjcwMEJGMy0wQkY4MEJGQTBDN0YwRDc5MEYwMS0wRjAzMEYxMzBGMTUtMEYxNzBGMUEtMEYxRjBGMzQwRjM2MEYzODBGQkUtMEZDNTBGQzctMEZDQzBGQ0UwRkNGMEZENS0wRkQ4MTA5RTEwOUYxMzkwLTEzOTkxOTQwMTlERS0xOUZGMUI2MS0xQjZBMUI3NC0xQjdDMjEwMDIxMDEyMTAzLTIxMDYyMTA4MjEwOTIxMTQyMTE2MjExNzIxMUUtMjEyMzIxMjUyMTI3MjEyOTIxMkUyMTNBMjEzQjIxNEEyMTRDMjE0RDIxNEYyMTk1LTIxOTkyMTlDLTIxOUYyMUExMjFBMjIxQTQyMUE1MjFBNy0yMUFEMjFBRi0yMUNEMjFEMDIxRDEyMUQzMjFENS0yMUYzMjMwMC0yMzA3MjMwQy0yMzFGMjMyMi0yMzI4MjMyQi0yMzdCMjM3RC0yMzlBMjNCNC0yM0RCMjNFMi0yM0YzMjQwMC0yNDI2MjQ0MC0yNDRBMjQ5Qy0yNEU5MjUwMC0yNUI2MjVCOC0yNUMwMjVDMi0yNUY3MjYwMC0yNjZFMjY3MC0yNkZGMjcwMS0yNzY3Mjc5NC0yN0JGMjgwMC0yOEZGMkIwMC0yQjJGMkI0NTJCNDYyQjUwLTJCNTkyQ0U1LTJDRUEyRTgwLTJFOTkyRTlCLTJFRjMyRjAwLTJGRDUyRkYwLTJGRkIzMDA0MzAxMjMwMTMzMDIwMzAzNjMwMzczMDNFMzAzRjMxOTAzMTkxMzE5Ni0zMTlGMzFDMC0zMUUzMzIwMC0zMjFFMzIyQS0zMjQ3MzI1MDMyNjAtMzI3RjMyOEEtMzJCMDMyQzAtMzJGRTMzMDAtMzNGRjREQzAtNERGRkE0OTAtQTRDNkE4MjgtQTgyQkE4MzZBODM3QTgzOUFBNzctQUE3OUZERkRGRkU0RkZFOEZGRURGRkVFRkZGQ0ZGRkRcIixcclxuICAgICAgICBaOiBcIjAwMjAwMEEwMTY4MDE4MEUyMDAwLTIwMEEyMDI4MjAyOTIwMkYyMDVGMzAwMFwiLFxyXG4gICAgICAgIFpzOiBcIjAwMjAwMEEwMTY4MDE4MEUyMDAwLTIwMEEyMDJGMjA1RjMwMDBcIixcclxuICAgICAgICBabDogXCIyMDI4XCIsXHJcbiAgICAgICAgWnA6IFwiMjAyOVwiLFxyXG4gICAgICAgIEM6IFwiMDAwMC0wMDFGMDA3Ri0wMDlGMDBBRDAzNzgwMzc5MDM3Ri0wMzgzMDM4QjAzOEQwM0EyMDUyOC0wNTMwMDU1NzA1NTgwNTYwMDU4ODA1OEItMDU4RTA1OTAwNUM4LTA1Q0YwNUVCLTA1RUYwNUY1LTA2MDUwNjFDMDYxRDA2REQwNzBFMDcwRjA3NEIwNzRDMDdCMi0wN0JGMDdGQi0wN0ZGMDgyRTA4MkYwODNGMDg1QzA4NUQwODVGLTA4OUYwOEExMDhBRC0wOEUzMDhGRjA5NzgwOTgwMDk4NDA5OEQwOThFMDk5MTA5OTIwOUE5MDlCMTA5QjMtMDlCNTA5QkEwOUJCMDlDNTA5QzYwOUM5MDlDQTA5Q0YtMDlENjA5RDgtMDlEQjA5REUwOUU0MDlFNTA5RkMtMEEwMDBBMDQwQTBCLTBBMEUwQTExMEExMjBBMjkwQTMxMEEzNDBBMzcwQTNBMEEzQjBBM0QwQTQzLTBBNDYwQTQ5MEE0QTBBNEUtMEE1MDBBNTItMEE1ODBBNUQwQTVGLTBBNjUwQTc2LTBBODAwQTg0MEE4RTBBOTIwQUE5MEFCMTBBQjQwQUJBMEFCQjBBQzYwQUNBMEFDRTBBQ0YwQUQxLTBBREYwQUU0MEFFNTBBRjItMEIwMDBCMDQwQjBEMEIwRTBCMTEwQjEyMEIyOTBCMzEwQjM0MEIzQTBCM0IwQjQ1MEI0NjBCNDkwQjRBMEI0RS0wQjU1MEI1OC0wQjVCMEI1RTBCNjQwQjY1MEI3OC0wQjgxMEI4NDBCOEItMEI4RDBCOTEwQjk2LTBCOTgwQjlCMEI5RDBCQTAtMEJBMjBCQTUtMEJBNzBCQUItMEJBRDBCQkEtMEJCRDBCQzMtMEJDNTBCQzkwQkNFMEJDRjBCRDEtMEJENjBCRDgtMEJFNTBCRkItMEMwMDBDMDQwQzBEMEMxMTBDMjkwQzM0MEMzQS0wQzNDMEM0NTBDNDkwQzRFLTBDNTQwQzU3MEM1QS0wQzVGMEM2NDBDNjUwQzcwLTBDNzcwQzgwMEM4MTBDODQwQzhEMEM5MTBDQTkwQ0I0MENCQTBDQkIwQ0M1MENDOTBDQ0UtMENENDBDRDctMENERDBDREYwQ0U0MENFNTBDRjAwQ0YzLTBEMDEwRDA0MEQwRDBEMTEwRDNCMEQzQzBENDUwRDQ5MEQ0Ri0wRDU2MEQ1OC0wRDVGMEQ2NDBENjUwRDc2LTBENzgwRDgwMEQ4MTBEODQwRDk3LTBEOTkwREIyMERCQzBEQkUwREJGMERDNy0wREM5MERDQi0wRENFMERENTBERDcwREUwLTBERjEwREY1LTBFMDAwRTNCLTBFM0UwRTVDLTBFODAwRTgzMEU4NTBFODYwRTg5MEU4QjBFOEMwRThFLTBFOTMwRTk4MEVBMDBFQTQwRUE2MEVBODBFQTkwRUFDMEVCQTBFQkUwRUJGMEVDNTBFQzcwRUNFMEVDRjBFREEwRURCMEVFMC0wRUZGMEY0ODBGNkQtMEY3MDBGOTgwRkJEMEZDRDBGREItMEZGRjEwQzYxMEM4LTEwQ0MxMENFMTBDRjEyNDkxMjRFMTI0RjEyNTcxMjU5MTI1RTEyNUYxMjg5MTI4RTEyOEYxMkIxMTJCNjEyQjcxMkJGMTJDMTEyQzYxMkM3MTJENzEzMTExMzE2MTMxNzEzNUIxMzVDMTM3RC0xMzdGMTM5QS0xMzlGMTNGNS0xM0ZGMTY5RC0xNjlGMTZGMS0xNkZGMTcwRDE3MTUtMTcxRjE3MzctMTczRjE3NTQtMTc1RjE3NkQxNzcxMTc3NC0xNzdGMTdERTE3REYxN0VBLTE3RUYxN0ZBLTE3RkYxODBGMTgxQS0xODFGMTg3OC0xODdGMThBQi0xOEFGMThGNi0xOEZGMTkxRC0xOTFGMTkyQy0xOTJGMTkzQy0xOTNGMTk0MS0xOTQzMTk2RTE5NkYxOTc1LTE5N0YxOUFDLTE5QUYxOUNBLTE5Q0YxOURCLTE5REQxQTFDMUExRDFBNUYxQTdEMUE3RTFBOEEtMUE4RjFBOUEtMUE5RjFBQUUtMUFGRjFCNEMtMUI0RjFCN0QtMUI3RjFCRjQtMUJGQjFDMzgtMUMzQTFDNEEtMUM0QzFDODAtMUNCRjFDQzgtMUNDRjFDRjctMUNGRjFERTctMURGQjFGMTYxRjE3MUYxRTFGMUYxRjQ2MUY0NzFGNEUxRjRGMUY1ODFGNUExRjVDMUY1RTFGN0UxRjdGMUZCNTFGQzUxRkQ0MUZENTFGREMxRkYwMUZGMTFGRjUxRkZGMjAwQi0yMDBGMjAyQS0yMDJFMjA2MC0yMDZGMjA3MjIwNzMyMDhGMjA5RC0yMDlGMjBCQS0yMENGMjBGMS0yMEZGMjE4QS0yMThGMjNGNC0yM0ZGMjQyNy0yNDNGMjQ0Qi0yNDVGMjcwMDJCNEQtMkI0RjJCNUEtMkJGRjJDMkYyQzVGMkNGNC0yQ0Y4MkQyNjJEMjgtMkQyQzJEMkUyRDJGMkQ2OC0yRDZFMkQ3MS0yRDdFMkQ5Ny0yRDlGMkRBNzJEQUYyREI3MkRCRjJEQzcyRENGMkRENzJEREYyRTNDLTJFN0YyRTlBMkVGNC0yRUZGMkZENi0yRkVGMkZGQy0yRkZGMzA0MDMwOTczMDk4MzEwMC0zMTA0MzEyRS0zMTMwMzE4RjMxQkItMzFCRjMxRTQtMzFFRjMyMUYzMkZGNERCNi00REJGOUZDRC05RkZGQTQ4RC1BNDhGQTRDNy1BNENGQTYyQy1BNjNGQTY5OC1BNjlFQTZGOC1BNkZGQTc4RkE3OTQtQTc5RkE3QUItQTdGN0E4MkMtQTgyRkE4M0EtQTgzRkE4NzgtQTg3RkE4QzUtQThDREE4REEtQThERkE4RkMtQThGRkE5NTQtQTk1RUE5N0QtQTk3RkE5Q0VBOURBLUE5RERBOUUwLUE5RkZBQTM3LUFBM0ZBQTRFQUE0RkFBNUFBQTVCQUE3Qy1BQTdGQUFDMy1BQURBQUFGNy1BQjAwQUIwN0FCMDhBQjBGQUIxMEFCMTctQUIxRkFCMjdBQjJGLUFCQkZBQkVFQUJFRkFCRkEtQUJGRkQ3QTQtRDdBRkQ3QzctRDdDQUQ3RkMtRjhGRkZBNkVGQTZGRkFEQS1GQUZGRkIwNy1GQjEyRkIxOC1GQjFDRkIzN0ZCM0RGQjNGRkI0MkZCNDVGQkMyLUZCRDJGRDQwLUZENEZGRDkwRkQ5MUZEQzgtRkRFRkZERkVGREZGRkUxQS1GRTFGRkUyNy1GRTJGRkU1M0ZFNjdGRTZDLUZFNkZGRTc1RkVGRC1GRjAwRkZCRi1GRkMxRkZDOEZGQzlGRkQwRkZEMUZGRDhGRkQ5RkZERC1GRkRGRkZFN0ZGRUYtRkZGQkZGRkVGRkZGXCIsXHJcbiAgICAgICAgQ2M6IFwiMDAwMC0wMDFGMDA3Ri0wMDlGXCIsXHJcbiAgICAgICAgQ2Y6IFwiMDBBRDA2MDAtMDYwNDA2REQwNzBGMjAwQi0yMDBGMjAyQS0yMDJFMjA2MC0yMDY0MjA2QS0yMDZGRkVGRkZGRjktRkZGQlwiLFxyXG4gICAgICAgIENvOiBcIkUwMDAtRjhGRlwiLFxyXG4gICAgICAgIENzOiBcIkQ4MDAtREZGRlwiLFxyXG4gICAgICAgIENuOiBcIjAzNzgwMzc5MDM3Ri0wMzgzMDM4QjAzOEQwM0EyMDUyOC0wNTMwMDU1NzA1NTgwNTYwMDU4ODA1OEItMDU4RTA1OTAwNUM4LTA1Q0YwNUVCLTA1RUYwNUY1LTA1RkYwNjA1MDYxQzA2MUQwNzBFMDc0QjA3NEMwN0IyLTA3QkYwN0ZCLTA3RkYwODJFMDgyRjA4M0YwODVDMDg1RDA4NUYtMDg5RjA4QTEwOEFELTA4RTMwOEZGMDk3ODA5ODAwOTg0MDk4RDA5OEUwOTkxMDk5MjA5QTkwOUIxMDlCMy0wOUI1MDlCQTA5QkIwOUM1MDlDNjA5QzkwOUNBMDlDRi0wOUQ2MDlEOC0wOURCMDlERTA5RTQwOUU1MDlGQy0wQTAwMEEwNDBBMEItMEEwRTBBMTEwQTEyMEEyOTBBMzEwQTM0MEEzNzBBM0EwQTNCMEEzRDBBNDMtMEE0NjBBNDkwQTRBMEE0RS0wQTUwMEE1Mi0wQTU4MEE1RDBBNUYtMEE2NTBBNzYtMEE4MDBBODQwQThFMEE5MjBBQTkwQUIxMEFCNDBBQkEwQUJCMEFDNjBBQ0EwQUNFMEFDRjBBRDEtMEFERjBBRTQwQUU1MEFGMi0wQjAwMEIwNDBCMEQwQjBFMEIxMTBCMTIwQjI5MEIzMTBCMzQwQjNBMEIzQjBCNDUwQjQ2MEI0OTBCNEEwQjRFLTBCNTUwQjU4LTBCNUIwQjVFMEI2NDBCNjUwQjc4LTBCODEwQjg0MEI4Qi0wQjhEMEI5MTBCOTYtMEI5ODBCOUIwQjlEMEJBMC0wQkEyMEJBNS0wQkE3MEJBQi0wQkFEMEJCQS0wQkJEMEJDMy0wQkM1MEJDOTBCQ0UwQkNGMEJEMS0wQkQ2MEJEOC0wQkU1MEJGQi0wQzAwMEMwNDBDMEQwQzExMEMyOTBDMzQwQzNBLTBDM0MwQzQ1MEM0OTBDNEUtMEM1NDBDNTcwQzVBLTBDNUYwQzY0MEM2NTBDNzAtMEM3NzBDODAwQzgxMEM4NDBDOEQwQzkxMENBOTBDQjQwQ0JBMENCQjBDQzUwQ0M5MENDRS0wQ0Q0MENENy0wQ0REMENERjBDRTQwQ0U1MENGMDBDRjMtMEQwMTBEMDQwRDBEMEQxMTBEM0IwRDNDMEQ0NTBENDkwRDRGLTBENTYwRDU4LTBENUYwRDY0MEQ2NTBENzYtMEQ3ODBEODAwRDgxMEQ4NDBEOTctMEQ5OTBEQjIwREJDMERCRTBEQkYwREM3LTBEQzkwRENCLTBEQ0UwREQ1MERENzBERTAtMERGMTBERjUtMEUwMDBFM0ItMEUzRTBFNUMtMEU4MDBFODMwRTg1MEU4NjBFODkwRThCMEU4QzBFOEUtMEU5MzBFOTgwRUEwMEVBNDBFQTYwRUE4MEVBOTBFQUMwRUJBMEVCRTBFQkYwRUM1MEVDNzBFQ0UwRUNGMEVEQTBFREIwRUUwLTBFRkYwRjQ4MEY2RC0wRjcwMEY5ODBGQkQwRkNEMEZEQi0wRkZGMTBDNjEwQzgtMTBDQzEwQ0UxMENGMTI0OTEyNEUxMjRGMTI1NzEyNTkxMjVFMTI1RjEyODkxMjhFMTI4RjEyQjExMkI2MTJCNzEyQkYxMkMxMTJDNjEyQzcxMkQ3MTMxMTEzMTYxMzE3MTM1QjEzNUMxMzdELTEzN0YxMzlBLTEzOUYxM0Y1LTEzRkYxNjlELTE2OUYxNkYxLTE2RkYxNzBEMTcxNS0xNzFGMTczNy0xNzNGMTc1NC0xNzVGMTc2RDE3NzExNzc0LTE3N0YxN0RFMTdERjE3RUEtMTdFRjE3RkEtMTdGRjE4MEYxODFBLTE4MUYxODc4LTE4N0YxOEFCLTE4QUYxOEY2LTE4RkYxOTFELTE5MUYxOTJDLTE5MkYxOTNDLTE5M0YxOTQxLTE5NDMxOTZFMTk2RjE5NzUtMTk3RjE5QUMtMTlBRjE5Q0EtMTlDRjE5REItMTlERDFBMUMxQTFEMUE1RjFBN0QxQTdFMUE4QS0xQThGMUE5QS0xQTlGMUFBRS0xQUZGMUI0Qy0xQjRGMUI3RC0xQjdGMUJGNC0xQkZCMUMzOC0xQzNBMUM0QS0xQzRDMUM4MC0xQ0JGMUNDOC0xQ0NGMUNGNy0xQ0ZGMURFNy0xREZCMUYxNjFGMTcxRjFFMUYxRjFGNDYxRjQ3MUY0RTFGNEYxRjU4MUY1QTFGNUMxRjVFMUY3RTFGN0YxRkI1MUZDNTFGRDQxRkQ1MUZEQzFGRjAxRkYxMUZGNTFGRkYyMDY1LTIwNjkyMDcyMjA3MzIwOEYyMDlELTIwOUYyMEJBLTIwQ0YyMEYxLTIwRkYyMThBLTIxOEYyM0Y0LTIzRkYyNDI3LTI0M0YyNDRCLTI0NUYyNzAwMkI0RC0yQjRGMkI1QS0yQkZGMkMyRjJDNUYyQ0Y0LTJDRjgyRDI2MkQyOC0yRDJDMkQyRTJEMkYyRDY4LTJENkUyRDcxLTJEN0UyRDk3LTJEOUYyREE3MkRBRjJEQjcyREJGMkRDNzJEQ0YyREQ3MkRERjJFM0MtMkU3RjJFOUEyRUY0LTJFRkYyRkQ2LTJGRUYyRkZDLTJGRkYzMDQwMzA5NzMwOTgzMTAwLTMxMDQzMTJFLTMxMzAzMThGMzFCQi0zMUJGMzFFNC0zMUVGMzIxRjMyRkY0REI2LTREQkY5RkNELTlGRkZBNDhELUE0OEZBNEM3LUE0Q0ZBNjJDLUE2M0ZBNjk4LUE2OUVBNkY4LUE2RkZBNzhGQTc5NC1BNzlGQTdBQi1BN0Y3QTgyQy1BODJGQTgzQS1BODNGQTg3OC1BODdGQThDNS1BOENEQThEQS1BOERGQThGQy1BOEZGQTk1NC1BOTVFQTk3RC1BOTdGQTlDRUE5REEtQTlEREE5RTAtQTlGRkFBMzctQUEzRkFBNEVBQTRGQUE1QUFBNUJBQTdDLUFBN0ZBQUMzLUFBREFBQUY3LUFCMDBBQjA3QUIwOEFCMEZBQjEwQUIxNy1BQjFGQUIyN0FCMkYtQUJCRkFCRUVBQkVGQUJGQS1BQkZGRDdBNC1EN0FGRDdDNy1EN0NBRDdGQy1EN0ZGRkE2RUZBNkZGQURBLUZBRkZGQjA3LUZCMTJGQjE4LUZCMUNGQjM3RkIzREZCM0ZGQjQyRkI0NUZCQzItRkJEMkZENDAtRkQ0RkZEOTBGRDkxRkRDOC1GREVGRkRGRUZERkZGRTFBLUZFMUZGRTI3LUZFMkZGRTUzRkU2N0ZFNkMtRkU2RkZFNzVGRUZERkVGRUZGMDBGRkJGLUZGQzFGRkM4RkZDOUZGRDBGRkQxRkZEOEZGRDlGRkRELUZGREZGRkU3RkZFRi1GRkY4RkZGRUZGRkZcIlxyXG4gICAgfSwge1xyXG4gICAgICAgIC8vTDogXCJMZXR0ZXJcIiwgLy8gSW5jbHVkZWQgaW4gdGhlIFVuaWNvZGUgQmFzZSBhZGRvblxyXG4gICAgICAgIExsOiBcIkxvd2VyY2FzZV9MZXR0ZXJcIixcclxuICAgICAgICBMdTogXCJVcHBlcmNhc2VfTGV0dGVyXCIsXHJcbiAgICAgICAgTHQ6IFwiVGl0bGVjYXNlX0xldHRlclwiLFxyXG4gICAgICAgIExtOiBcIk1vZGlmaWVyX0xldHRlclwiLFxyXG4gICAgICAgIExvOiBcIk90aGVyX0xldHRlclwiLFxyXG4gICAgICAgIE06IFwiTWFya1wiLFxyXG4gICAgICAgIE1uOiBcIk5vbnNwYWNpbmdfTWFya1wiLFxyXG4gICAgICAgIE1jOiBcIlNwYWNpbmdfTWFya1wiLFxyXG4gICAgICAgIE1lOiBcIkVuY2xvc2luZ19NYXJrXCIsXHJcbiAgICAgICAgTjogXCJOdW1iZXJcIixcclxuICAgICAgICBOZDogXCJEZWNpbWFsX051bWJlclwiLFxyXG4gICAgICAgIE5sOiBcIkxldHRlcl9OdW1iZXJcIixcclxuICAgICAgICBObzogXCJPdGhlcl9OdW1iZXJcIixcclxuICAgICAgICBQOiBcIlB1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUGQ6IFwiRGFzaF9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBzOiBcIk9wZW5fUHVuY3R1YXRpb25cIixcclxuICAgICAgICBQZTogXCJDbG9zZV9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBpOiBcIkluaXRpYWxfUHVuY3R1YXRpb25cIixcclxuICAgICAgICBQZjogXCJGaW5hbF9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBjOiBcIkNvbm5lY3Rvcl9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBvOiBcIk90aGVyX1B1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUzogXCJTeW1ib2xcIixcclxuICAgICAgICBTbTogXCJNYXRoX1N5bWJvbFwiLFxyXG4gICAgICAgIFNjOiBcIkN1cnJlbmN5X1N5bWJvbFwiLFxyXG4gICAgICAgIFNrOiBcIk1vZGlmaWVyX1N5bWJvbFwiLFxyXG4gICAgICAgIFNvOiBcIk90aGVyX1N5bWJvbFwiLFxyXG4gICAgICAgIFo6IFwiU2VwYXJhdG9yXCIsXHJcbiAgICAgICAgWnM6IFwiU3BhY2VfU2VwYXJhdG9yXCIsXHJcbiAgICAgICAgWmw6IFwiTGluZV9TZXBhcmF0b3JcIixcclxuICAgICAgICBacDogXCJQYXJhZ3JhcGhfU2VwYXJhdG9yXCIsXHJcbiAgICAgICAgQzogXCJPdGhlclwiLFxyXG4gICAgICAgIENjOiBcIkNvbnRyb2xcIixcclxuICAgICAgICBDZjogXCJGb3JtYXRcIixcclxuICAgICAgICBDbzogXCJQcml2YXRlX1VzZVwiLFxyXG4gICAgICAgIENzOiBcIlN1cnJvZ2F0ZVwiLFxyXG4gICAgICAgIENuOiBcIlVuYXNzaWduZWRcIlxyXG4gICAgfSk7XHJcblxyXG59KFhSZWdFeHApKTtcclxuXHJcblxuLyoqKioqIHVuaWNvZGUtc2NyaXB0cy5qcyAqKioqKi9cblxuLyohXHJcbiAqIFhSZWdFeHAgVW5pY29kZSBTY3JpcHRzIHYxLjIuMFxyXG4gKiAoYykgMjAxMC0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICogVXNlcyBVbmljb2RlIDYuMSA8aHR0cDovL3VuaWNvZGUub3JnLz5cclxuICovXHJcblxyXG4vKipcclxuICogQWRkcyBzdXBwb3J0IGZvciBhbGwgVW5pY29kZSBzY3JpcHRzIGluIHRoZSBCYXNpYyBNdWx0aWxpbmd1YWwgUGxhbmUgKFUrMDAwMC1VK0ZGRkYpLlxyXG4gKiBFLmcuLCBgXFxwe0xhdGlufWAuIFRva2VuIG5hbWVzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgYW55IHNwYWNlcywgaHlwaGVucywgYW5kIHVuZGVyc2NvcmVzXHJcbiAqIGFyZSBpZ25vcmVkLlxyXG4gKiBAcmVxdWlyZXMgWFJlZ0V4cCwgWFJlZ0V4cCBVbmljb2RlIEJhc2VcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaWYgKCFYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiVW5pY29kZSBCYXNlIG11c3QgYmUgbG9hZGVkIGJlZm9yZSBVbmljb2RlIFNjcmlwdHNcIik7XHJcbiAgICB9XHJcblxyXG4gICAgWFJlZ0V4cC5pbnN0YWxsKFwiZXh0ZW5zaWJpbGl0eVwiKTtcclxuXHJcbiAgICBYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKHtcclxuICAgICAgICBBcmFiaWM6IFwiMDYwMC0wNjA0MDYwNi0wNjBCMDYwRC0wNjFBMDYxRTA2MjAtMDYzRjA2NDEtMDY0QTA2NTYtMDY1RTA2NkEtMDY2RjA2NzEtMDZEQzA2REUtMDZGRjA3NTAtMDc3RjA4QTAwOEEyLTA4QUMwOEU0LTA4RkVGQjUwLUZCQzFGQkQzLUZEM0RGRDUwLUZEOEZGRDkyLUZEQzdGREYwLUZERkNGRTcwLUZFNzRGRTc2LUZFRkNcIixcclxuICAgICAgICBBcm1lbmlhbjogXCIwNTMxLTA1NTYwNTU5LTA1NUYwNTYxLTA1ODcwNThBMDU4RkZCMTMtRkIxN1wiLFxyXG4gICAgICAgIEJhbGluZXNlOiBcIjFCMDAtMUI0QjFCNTAtMUI3Q1wiLFxyXG4gICAgICAgIEJhbXVtOiBcIkE2QTAtQTZGN1wiLFxyXG4gICAgICAgIEJhdGFrOiBcIjFCQzAtMUJGMzFCRkMtMUJGRlwiLFxyXG4gICAgICAgIEJlbmdhbGk6IFwiMDk4MS0wOTgzMDk4NS0wOThDMDk4RjA5OTAwOTkzLTA5QTgwOUFBLTA5QjAwOUIyMDlCNi0wOUI5MDlCQy0wOUM0MDlDNzA5QzgwOUNCLTA5Q0UwOUQ3MDlEQzA5REQwOURGLTA5RTMwOUU2LTA5RkJcIixcclxuICAgICAgICBCb3BvbW9mbzogXCIwMkVBMDJFQjMxMDUtMzEyRDMxQTAtMzFCQVwiLFxyXG4gICAgICAgIEJyYWlsbGU6IFwiMjgwMC0yOEZGXCIsXHJcbiAgICAgICAgQnVnaW5lc2U6IFwiMUEwMC0xQTFCMUExRTFBMUZcIixcclxuICAgICAgICBCdWhpZDogXCIxNzQwLTE3NTNcIixcclxuICAgICAgICBDYW5hZGlhbl9BYm9yaWdpbmFsOiBcIjE0MDAtMTY3RjE4QjAtMThGNVwiLFxyXG4gICAgICAgIENoYW06IFwiQUEwMC1BQTM2QUE0MC1BQTREQUE1MC1BQTU5QUE1Qy1BQTVGXCIsXHJcbiAgICAgICAgQ2hlcm9rZWU6IFwiMTNBMC0xM0Y0XCIsXHJcbiAgICAgICAgQ29tbW9uOiBcIjAwMDAtMDA0MDAwNUItMDA2MDAwN0ItMDBBOTAwQUItMDBCOTAwQkItMDBCRjAwRDcwMEY3MDJCOS0wMkRGMDJFNS0wMkU5MDJFQy0wMkZGMDM3NDAzN0UwMzg1MDM4NzA1ODkwNjBDMDYxQjA2MUYwNjQwMDY2MC0wNjY5MDZERDA5NjQwOTY1MEUzRjBGRDUtMEZEODEwRkIxNkVCLTE2RUQxNzM1MTczNjE4MDIxODAzMTgwNTFDRDMxQ0UxMUNFOS0xQ0VDMUNFRS0xQ0YzMUNGNTFDRjYyMDAwLTIwMEIyMDBFLTIwNjQyMDZBLTIwNzAyMDc0LTIwN0UyMDgwLTIwOEUyMEEwLTIwQjkyMTAwLTIxMjUyMTI3LTIxMjkyMTJDLTIxMzEyMTMzLTIxNEQyMTRGLTIxNUYyMTg5MjE5MC0yM0YzMjQwMC0yNDI2MjQ0MC0yNDRBMjQ2MC0yNkZGMjcwMS0yN0ZGMjkwMC0yQjRDMkI1MC0yQjU5MkUwMC0yRTNCMkZGMC0yRkZCMzAwMC0zMDA0MzAwNjMwMDgtMzAyMDMwMzAtMzAzNzMwM0MtMzAzRjMwOUIzMDlDMzBBMDMwRkIzMEZDMzE5MC0zMTlGMzFDMC0zMUUzMzIyMC0zMjVGMzI3Ri0zMkNGMzM1OC0zM0ZGNERDMC00REZGQTcwMC1BNzIxQTc4OC1BNzhBQTgzMC1BODM5RkQzRUZEM0ZGREZERkUxMC1GRTE5RkUzMC1GRTUyRkU1NC1GRTY2RkU2OC1GRTZCRkVGRkZGMDEtRkYyMEZGM0ItRkY0MEZGNUItRkY2NUZGNzBGRjlFRkY5RkZGRTAtRkZFNkZGRTgtRkZFRUZGRjktRkZGRFwiLFxyXG4gICAgICAgIENvcHRpYzogXCIwM0UyLTAzRUYyQzgwLTJDRjMyQ0Y5LTJDRkZcIixcclxuICAgICAgICBDeXJpbGxpYzogXCIwNDAwLTA0ODQwNDg3LTA1MjcxRDJCMUQ3ODJERTAtMkRGRkE2NDAtQTY5N0E2OUZcIixcclxuICAgICAgICBEZXZhbmFnYXJpOiBcIjA5MDAtMDk1MDA5NTMtMDk2MzA5NjYtMDk3NzA5NzktMDk3RkE4RTAtQThGQlwiLFxyXG4gICAgICAgIEV0aGlvcGljOiBcIjEyMDAtMTI0ODEyNEEtMTI0RDEyNTAtMTI1NjEyNTgxMjVBLTEyNUQxMjYwLTEyODgxMjhBLTEyOEQxMjkwLTEyQjAxMkIyLTEyQjUxMkI4LTEyQkUxMkMwMTJDMi0xMkM1MTJDOC0xMkQ2MTJEOC0xMzEwMTMxMi0xMzE1MTMxOC0xMzVBMTM1RC0xMzdDMTM4MC0xMzk5MkQ4MC0yRDk2MkRBMC0yREE2MkRBOC0yREFFMkRCMC0yREI2MkRCOC0yREJFMkRDMC0yREM2MkRDOC0yRENFMkREMC0yREQ2MkREOC0yRERFQUIwMS1BQjA2QUIwOS1BQjBFQUIxMS1BQjE2QUIyMC1BQjI2QUIyOC1BQjJFXCIsXHJcbiAgICAgICAgR2VvcmdpYW46IFwiMTBBMC0xMEM1MTBDNzEwQ0QxMEQwLTEwRkExMEZDLTEwRkYyRDAwLTJEMjUyRDI3MkQyRFwiLFxyXG4gICAgICAgIEdsYWdvbGl0aWM6IFwiMkMwMC0yQzJFMkMzMC0yQzVFXCIsXHJcbiAgICAgICAgR3JlZWs6IFwiMDM3MC0wMzczMDM3NS0wMzc3MDM3QS0wMzdEMDM4NDAzODYwMzg4LTAzOEEwMzhDMDM4RS0wM0ExMDNBMy0wM0UxMDNGMC0wM0ZGMUQyNi0xRDJBMUQ1RC0xRDYxMUQ2Ni0xRDZBMURCRjFGMDAtMUYxNTFGMTgtMUYxRDFGMjAtMUY0NTFGNDgtMUY0RDFGNTAtMUY1NzFGNTkxRjVCMUY1RDFGNUYtMUY3RDFGODAtMUZCNDFGQjYtMUZDNDFGQzYtMUZEMzFGRDYtMUZEQjFGREQtMUZFRjFGRjItMUZGNDFGRjYtMUZGRTIxMjZcIixcclxuICAgICAgICBHdWphcmF0aTogXCIwQTgxLTBBODMwQTg1LTBBOEQwQThGLTBBOTEwQTkzLTBBQTgwQUFBLTBBQjAwQUIyMEFCMzBBQjUtMEFCOTBBQkMtMEFDNTBBQzctMEFDOTBBQ0ItMEFDRDBBRDAwQUUwLTBBRTMwQUU2LTBBRjFcIixcclxuICAgICAgICBHdXJtdWtoaTogXCIwQTAxLTBBMDMwQTA1LTBBMEEwQTBGMEExMDBBMTMtMEEyODBBMkEtMEEzMDBBMzIwQTMzMEEzNTBBMzYwQTM4MEEzOTBBM0MwQTNFLTBBNDIwQTQ3MEE0ODBBNEItMEE0RDBBNTEwQTU5LTBBNUMwQTVFMEE2Ni0wQTc1XCIsXHJcbiAgICAgICAgSGFuOiBcIjJFODAtMkU5OTJFOUItMkVGMzJGMDAtMkZENTMwMDUzMDA3MzAyMS0zMDI5MzAzOC0zMDNCMzQwMC00REI1NEUwMC05RkNDRjkwMC1GQTZERkE3MC1GQUQ5XCIsXHJcbiAgICAgICAgSGFuZ3VsOiBcIjExMDAtMTFGRjMwMkUzMDJGMzEzMS0zMThFMzIwMC0zMjFFMzI2MC0zMjdFQTk2MC1BOTdDQUMwMC1EN0EzRDdCMC1EN0M2RDdDQi1EN0ZCRkZBMC1GRkJFRkZDMi1GRkM3RkZDQS1GRkNGRkZEMi1GRkQ3RkZEQS1GRkRDXCIsXHJcbiAgICAgICAgSGFudW5vbzogXCIxNzIwLTE3MzRcIixcclxuICAgICAgICBIZWJyZXc6IFwiMDU5MS0wNUM3MDVEMC0wNUVBMDVGMC0wNUY0RkIxRC1GQjM2RkIzOC1GQjNDRkIzRUZCNDBGQjQxRkI0M0ZCNDRGQjQ2LUZCNEZcIixcclxuICAgICAgICBIaXJhZ2FuYTogXCIzMDQxLTMwOTYzMDlELTMwOUZcIixcclxuICAgICAgICBJbmhlcml0ZWQ6IFwiMDMwMC0wMzZGMDQ4NTA0ODYwNjRCLTA2NTUwNjVGMDY3MDA5NTEwOTUyMUNEMC0xQ0QyMUNENC0xQ0UwMUNFMi0xQ0U4MUNFRDFDRjQxREMwLTFERTYxREZDLTFERkYyMDBDMjAwRDIwRDAtMjBGMDMwMkEtMzAyRDMwOTkzMDlBRkUwMC1GRTBGRkUyMC1GRTI2XCIsXHJcbiAgICAgICAgSmF2YW5lc2U6IFwiQTk4MC1BOUNEQTlDRi1BOUQ5QTlERUE5REZcIixcclxuICAgICAgICBLYW5uYWRhOiBcIjBDODIwQzgzMEM4NS0wQzhDMEM4RS0wQzkwMEM5Mi0wQ0E4MENBQS0wQ0IzMENCNS0wQ0I5MENCQy0wQ0M0MENDNi0wQ0M4MENDQS0wQ0NEMENENTBDRDYwQ0RFMENFMC0wQ0UzMENFNi0wQ0VGMENGMTBDRjJcIixcclxuICAgICAgICBLYXRha2FuYTogXCIzMEExLTMwRkEzMEZELTMwRkYzMUYwLTMxRkYzMkQwLTMyRkUzMzAwLTMzNTdGRjY2LUZGNkZGRjcxLUZGOURcIixcclxuICAgICAgICBLYXlhaF9MaTogXCJBOTAwLUE5MkZcIixcclxuICAgICAgICBLaG1lcjogXCIxNzgwLTE3REQxN0UwLTE3RTkxN0YwLTE3RjkxOUUwLTE5RkZcIixcclxuICAgICAgICBMYW86IFwiMEU4MTBFODIwRTg0MEU4NzBFODgwRThBMEU4RDBFOTQtMEU5NzBFOTktMEU5RjBFQTEtMEVBMzBFQTUwRUE3MEVBQTBFQUIwRUFELTBFQjkwRUJCLTBFQkQwRUMwLTBFQzQwRUM2MEVDOC0wRUNEMEVEMC0wRUQ5MEVEQy0wRURGXCIsXHJcbiAgICAgICAgTGF0aW46IFwiMDA0MS0wMDVBMDA2MS0wMDdBMDBBQTAwQkEwMEMwLTAwRDYwMEQ4LTAwRjYwMEY4LTAyQjgwMkUwLTAyRTQxRDAwLTFEMjUxRDJDLTFENUMxRDYyLTFENjUxRDZCLTFENzcxRDc5LTFEQkUxRTAwLTFFRkYyMDcxMjA3RjIwOTAtMjA5QzIxMkEyMTJCMjEzMjIxNEUyMTYwLTIxODgyQzYwLTJDN0ZBNzIyLUE3ODdBNzhCLUE3OEVBNzkwLUE3OTNBN0EwLUE3QUFBN0Y4LUE3RkZGQjAwLUZCMDZGRjIxLUZGM0FGRjQxLUZGNUFcIixcclxuICAgICAgICBMZXBjaGE6IFwiMUMwMC0xQzM3MUMzQi0xQzQ5MUM0RC0xQzRGXCIsXHJcbiAgICAgICAgTGltYnU6IFwiMTkwMC0xOTFDMTkyMC0xOTJCMTkzMC0xOTNCMTk0MDE5NDQtMTk0RlwiLFxyXG4gICAgICAgIExpc3U6IFwiQTREMC1BNEZGXCIsXHJcbiAgICAgICAgTWFsYXlhbGFtOiBcIjBEMDIwRDAzMEQwNS0wRDBDMEQwRS0wRDEwMEQxMi0wRDNBMEQzRC0wRDQ0MEQ0Ni0wRDQ4MEQ0QS0wRDRFMEQ1NzBENjAtMEQ2MzBENjYtMEQ3NTBENzktMEQ3RlwiLFxyXG4gICAgICAgIE1hbmRhaWM6IFwiMDg0MC0wODVCMDg1RVwiLFxyXG4gICAgICAgIE1lZXRlaV9NYXllazogXCJBQUUwLUFBRjZBQkMwLUFCRURBQkYwLUFCRjlcIixcclxuICAgICAgICBNb25nb2xpYW46IFwiMTgwMDE4MDExODA0MTgwNi0xODBFMTgxMC0xODE5MTgyMC0xODc3MTg4MC0xOEFBXCIsXHJcbiAgICAgICAgTXlhbm1hcjogXCIxMDAwLTEwOUZBQTYwLUFBN0JcIixcclxuICAgICAgICBOZXdfVGFpX0x1ZTogXCIxOTgwLTE5QUIxOUIwLTE5QzkxOUQwLTE5REExOURFMTlERlwiLFxyXG4gICAgICAgIE5rbzogXCIwN0MwLTA3RkFcIixcclxuICAgICAgICBPZ2hhbTogXCIxNjgwLTE2OUNcIixcclxuICAgICAgICBPbF9DaGlraTogXCIxQzUwLTFDN0ZcIixcclxuICAgICAgICBPcml5YTogXCIwQjAxLTBCMDMwQjA1LTBCMEMwQjBGMEIxMDBCMTMtMEIyODBCMkEtMEIzMDBCMzIwQjMzMEIzNS0wQjM5MEIzQy0wQjQ0MEI0NzBCNDgwQjRCLTBCNEQwQjU2MEI1NzBCNUMwQjVEMEI1Ri0wQjYzMEI2Ni0wQjc3XCIsXHJcbiAgICAgICAgUGhhZ3NfUGE6IFwiQTg0MC1BODc3XCIsXHJcbiAgICAgICAgUmVqYW5nOiBcIkE5MzAtQTk1M0E5NUZcIixcclxuICAgICAgICBSdW5pYzogXCIxNkEwLTE2RUExNkVFLTE2RjBcIixcclxuICAgICAgICBTYW1hcml0YW46IFwiMDgwMC0wODJEMDgzMC0wODNFXCIsXHJcbiAgICAgICAgU2F1cmFzaHRyYTogXCJBODgwLUE4QzRBOENFLUE4RDlcIixcclxuICAgICAgICBTaW5oYWxhOiBcIjBEODIwRDgzMEQ4NS0wRDk2MEQ5QS0wREIxMERCMy0wREJCMERCRDBEQzAtMERDNjBEQ0EwRENGLTBERDQwREQ2MEREOC0wRERGMERGMi0wREY0XCIsXHJcbiAgICAgICAgU3VuZGFuZXNlOiBcIjFCODAtMUJCRjFDQzAtMUNDN1wiLFxyXG4gICAgICAgIFN5bG90aV9OYWdyaTogXCJBODAwLUE4MkJcIixcclxuICAgICAgICBTeXJpYWM6IFwiMDcwMC0wNzBEMDcwRi0wNzRBMDc0RC0wNzRGXCIsXHJcbiAgICAgICAgVGFnYWxvZzogXCIxNzAwLTE3MEMxNzBFLTE3MTRcIixcclxuICAgICAgICBUYWdiYW53YTogXCIxNzYwLTE3NkMxNzZFLTE3NzAxNzcyMTc3M1wiLFxyXG4gICAgICAgIFRhaV9MZTogXCIxOTUwLTE5NkQxOTcwLTE5NzRcIixcclxuICAgICAgICBUYWlfVGhhbTogXCIxQTIwLTFBNUUxQTYwLTFBN0MxQTdGLTFBODkxQTkwLTFBOTkxQUEwLTFBQURcIixcclxuICAgICAgICBUYWlfVmlldDogXCJBQTgwLUFBQzJBQURCLUFBREZcIixcclxuICAgICAgICBUYW1pbDogXCIwQjgyMEI4MzBCODUtMEI4QTBCOEUtMEI5MDBCOTItMEI5NTBCOTkwQjlBMEI5QzBCOUUwQjlGMEJBMzBCQTQwQkE4LTBCQUEwQkFFLTBCQjkwQkJFLTBCQzIwQkM2LTBCQzgwQkNBLTBCQ0QwQkQwMEJENzBCRTYtMEJGQVwiLFxyXG4gICAgICAgIFRlbHVndTogXCIwQzAxLTBDMDMwQzA1LTBDMEMwQzBFLTBDMTAwQzEyLTBDMjgwQzJBLTBDMzMwQzM1LTBDMzkwQzNELTBDNDQwQzQ2LTBDNDgwQzRBLTBDNEQwQzU1MEM1NjBDNTgwQzU5MEM2MC0wQzYzMEM2Ni0wQzZGMEM3OC0wQzdGXCIsXHJcbiAgICAgICAgVGhhYW5hOiBcIjA3ODAtMDdCMVwiLFxyXG4gICAgICAgIFRoYWk6IFwiMEUwMS0wRTNBMEU0MC0wRTVCXCIsXHJcbiAgICAgICAgVGliZXRhbjogXCIwRjAwLTBGNDcwRjQ5LTBGNkMwRjcxLTBGOTcwRjk5LTBGQkMwRkJFLTBGQ0MwRkNFLTBGRDQwRkQ5MEZEQVwiLFxyXG4gICAgICAgIFRpZmluYWdoOiBcIjJEMzAtMkQ2NzJENkYyRDcwMkQ3RlwiLFxyXG4gICAgICAgIFZhaTogXCJBNTAwLUE2MkJcIixcclxuICAgICAgICBZaTogXCJBMDAwLUE0OENBNDkwLUE0QzZcIlxyXG4gICAgfSk7XHJcblxyXG59KFhSZWdFeHApKTtcclxuXHJcblxuLyoqKioqIHVuaWNvZGUtYmxvY2tzLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCBVbmljb2RlIEJsb2NrcyB2MS4yLjBcclxuICogKGMpIDIwMTAtMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqIFVzZXMgVW5pY29kZSA2LjEgPGh0dHA6Ly91bmljb2RlLm9yZy8+XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgc3VwcG9ydCBmb3IgYWxsIFVuaWNvZGUgYmxvY2tzIGluIHRoZSBCYXNpYyBNdWx0aWxpbmd1YWwgUGxhbmUgKFUrMDAwMC1VK0ZGRkYpLiBVbmljb2RlXHJcbiAqIGJsb2NrcyB1c2UgdGhlIHByZWZpeCBcIkluXCIuIEUuZy4sIGBcXHB7SW5CYXNpY0xhdGlufWAuIFRva2VuIG5hbWVzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgYW55XHJcbiAqIHNwYWNlcywgaHlwaGVucywgYW5kIHVuZGVyc2NvcmVzIGFyZSBpZ25vcmVkLlxyXG4gKiBAcmVxdWlyZXMgWFJlZ0V4cCwgWFJlZ0V4cCBVbmljb2RlIEJhc2VcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaWYgKCFYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiVW5pY29kZSBCYXNlIG11c3QgYmUgbG9hZGVkIGJlZm9yZSBVbmljb2RlIEJsb2Nrc1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBYUmVnRXhwLmluc3RhbGwoXCJleHRlbnNpYmlsaXR5XCIpO1xyXG5cclxuICAgIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2Uoe1xyXG4gICAgICAgIEluQmFzaWNfTGF0aW46IFwiMDAwMC0wMDdGXCIsXHJcbiAgICAgICAgSW5MYXRpbl8xX1N1cHBsZW1lbnQ6IFwiMDA4MC0wMEZGXCIsXHJcbiAgICAgICAgSW5MYXRpbl9FeHRlbmRlZF9BOiBcIjAxMDAtMDE3RlwiLFxyXG4gICAgICAgIEluTGF0aW5fRXh0ZW5kZWRfQjogXCIwMTgwLTAyNEZcIixcclxuICAgICAgICBJbklQQV9FeHRlbnNpb25zOiBcIjAyNTAtMDJBRlwiLFxyXG4gICAgICAgIEluU3BhY2luZ19Nb2RpZmllcl9MZXR0ZXJzOiBcIjAyQjAtMDJGRlwiLFxyXG4gICAgICAgIEluQ29tYmluaW5nX0RpYWNyaXRpY2FsX01hcmtzOiBcIjAzMDAtMDM2RlwiLFxyXG4gICAgICAgIEluR3JlZWtfYW5kX0NvcHRpYzogXCIwMzcwLTAzRkZcIixcclxuICAgICAgICBJbkN5cmlsbGljOiBcIjA0MDAtMDRGRlwiLFxyXG4gICAgICAgIEluQ3lyaWxsaWNfU3VwcGxlbWVudDogXCIwNTAwLTA1MkZcIixcclxuICAgICAgICBJbkFybWVuaWFuOiBcIjA1MzAtMDU4RlwiLFxyXG4gICAgICAgIEluSGVicmV3OiBcIjA1OTAtMDVGRlwiLFxyXG4gICAgICAgIEluQXJhYmljOiBcIjA2MDAtMDZGRlwiLFxyXG4gICAgICAgIEluU3lyaWFjOiBcIjA3MDAtMDc0RlwiLFxyXG4gICAgICAgIEluQXJhYmljX1N1cHBsZW1lbnQ6IFwiMDc1MC0wNzdGXCIsXHJcbiAgICAgICAgSW5UaGFhbmE6IFwiMDc4MC0wN0JGXCIsXHJcbiAgICAgICAgSW5OS286IFwiMDdDMC0wN0ZGXCIsXHJcbiAgICAgICAgSW5TYW1hcml0YW46IFwiMDgwMC0wODNGXCIsXHJcbiAgICAgICAgSW5NYW5kYWljOiBcIjA4NDAtMDg1RlwiLFxyXG4gICAgICAgIEluQXJhYmljX0V4dGVuZGVkX0E6IFwiMDhBMC0wOEZGXCIsXHJcbiAgICAgICAgSW5EZXZhbmFnYXJpOiBcIjA5MDAtMDk3RlwiLFxyXG4gICAgICAgIEluQmVuZ2FsaTogXCIwOTgwLTA5RkZcIixcclxuICAgICAgICBJbkd1cm11a2hpOiBcIjBBMDAtMEE3RlwiLFxyXG4gICAgICAgIEluR3VqYXJhdGk6IFwiMEE4MC0wQUZGXCIsXHJcbiAgICAgICAgSW5Pcml5YTogXCIwQjAwLTBCN0ZcIixcclxuICAgICAgICBJblRhbWlsOiBcIjBCODAtMEJGRlwiLFxyXG4gICAgICAgIEluVGVsdWd1OiBcIjBDMDAtMEM3RlwiLFxyXG4gICAgICAgIEluS2FubmFkYTogXCIwQzgwLTBDRkZcIixcclxuICAgICAgICBJbk1hbGF5YWxhbTogXCIwRDAwLTBEN0ZcIixcclxuICAgICAgICBJblNpbmhhbGE6IFwiMEQ4MC0wREZGXCIsXHJcbiAgICAgICAgSW5UaGFpOiBcIjBFMDAtMEU3RlwiLFxyXG4gICAgICAgIEluTGFvOiBcIjBFODAtMEVGRlwiLFxyXG4gICAgICAgIEluVGliZXRhbjogXCIwRjAwLTBGRkZcIixcclxuICAgICAgICBJbk15YW5tYXI6IFwiMTAwMC0xMDlGXCIsXHJcbiAgICAgICAgSW5HZW9yZ2lhbjogXCIxMEEwLTEwRkZcIixcclxuICAgICAgICBJbkhhbmd1bF9KYW1vOiBcIjExMDAtMTFGRlwiLFxyXG4gICAgICAgIEluRXRoaW9waWM6IFwiMTIwMC0xMzdGXCIsXHJcbiAgICAgICAgSW5FdGhpb3BpY19TdXBwbGVtZW50OiBcIjEzODAtMTM5RlwiLFxyXG4gICAgICAgIEluQ2hlcm9rZWU6IFwiMTNBMC0xM0ZGXCIsXHJcbiAgICAgICAgSW5VbmlmaWVkX0NhbmFkaWFuX0Fib3JpZ2luYWxfU3lsbGFiaWNzOiBcIjE0MDAtMTY3RlwiLFxyXG4gICAgICAgIEluT2doYW06IFwiMTY4MC0xNjlGXCIsXHJcbiAgICAgICAgSW5SdW5pYzogXCIxNkEwLTE2RkZcIixcclxuICAgICAgICBJblRhZ2Fsb2c6IFwiMTcwMC0xNzFGXCIsXHJcbiAgICAgICAgSW5IYW51bm9vOiBcIjE3MjAtMTczRlwiLFxyXG4gICAgICAgIEluQnVoaWQ6IFwiMTc0MC0xNzVGXCIsXHJcbiAgICAgICAgSW5UYWdiYW53YTogXCIxNzYwLTE3N0ZcIixcclxuICAgICAgICBJbktobWVyOiBcIjE3ODAtMTdGRlwiLFxyXG4gICAgICAgIEluTW9uZ29saWFuOiBcIjE4MDAtMThBRlwiLFxyXG4gICAgICAgIEluVW5pZmllZF9DYW5hZGlhbl9BYm9yaWdpbmFsX1N5bGxhYmljc19FeHRlbmRlZDogXCIxOEIwLTE4RkZcIixcclxuICAgICAgICBJbkxpbWJ1OiBcIjE5MDAtMTk0RlwiLFxyXG4gICAgICAgIEluVGFpX0xlOiBcIjE5NTAtMTk3RlwiLFxyXG4gICAgICAgIEluTmV3X1RhaV9MdWU6IFwiMTk4MC0xOURGXCIsXHJcbiAgICAgICAgSW5LaG1lcl9TeW1ib2xzOiBcIjE5RTAtMTlGRlwiLFxyXG4gICAgICAgIEluQnVnaW5lc2U6IFwiMUEwMC0xQTFGXCIsXHJcbiAgICAgICAgSW5UYWlfVGhhbTogXCIxQTIwLTFBQUZcIixcclxuICAgICAgICBJbkJhbGluZXNlOiBcIjFCMDAtMUI3RlwiLFxyXG4gICAgICAgIEluU3VuZGFuZXNlOiBcIjFCODAtMUJCRlwiLFxyXG4gICAgICAgIEluQmF0YWs6IFwiMUJDMC0xQkZGXCIsXHJcbiAgICAgICAgSW5MZXBjaGE6IFwiMUMwMC0xQzRGXCIsXHJcbiAgICAgICAgSW5PbF9DaGlraTogXCIxQzUwLTFDN0ZcIixcclxuICAgICAgICBJblN1bmRhbmVzZV9TdXBwbGVtZW50OiBcIjFDQzAtMUNDRlwiLFxyXG4gICAgICAgIEluVmVkaWNfRXh0ZW5zaW9uczogXCIxQ0QwLTFDRkZcIixcclxuICAgICAgICBJblBob25ldGljX0V4dGVuc2lvbnM6IFwiMUQwMC0xRDdGXCIsXHJcbiAgICAgICAgSW5QaG9uZXRpY19FeHRlbnNpb25zX1N1cHBsZW1lbnQ6IFwiMUQ4MC0xREJGXCIsXHJcbiAgICAgICAgSW5Db21iaW5pbmdfRGlhY3JpdGljYWxfTWFya3NfU3VwcGxlbWVudDogXCIxREMwLTFERkZcIixcclxuICAgICAgICBJbkxhdGluX0V4dGVuZGVkX0FkZGl0aW9uYWw6IFwiMUUwMC0xRUZGXCIsXHJcbiAgICAgICAgSW5HcmVla19FeHRlbmRlZDogXCIxRjAwLTFGRkZcIixcclxuICAgICAgICBJbkdlbmVyYWxfUHVuY3R1YXRpb246IFwiMjAwMC0yMDZGXCIsXHJcbiAgICAgICAgSW5TdXBlcnNjcmlwdHNfYW5kX1N1YnNjcmlwdHM6IFwiMjA3MC0yMDlGXCIsXHJcbiAgICAgICAgSW5DdXJyZW5jeV9TeW1ib2xzOiBcIjIwQTAtMjBDRlwiLFxyXG4gICAgICAgIEluQ29tYmluaW5nX0RpYWNyaXRpY2FsX01hcmtzX2Zvcl9TeW1ib2xzOiBcIjIwRDAtMjBGRlwiLFxyXG4gICAgICAgIEluTGV0dGVybGlrZV9TeW1ib2xzOiBcIjIxMDAtMjE0RlwiLFxyXG4gICAgICAgIEluTnVtYmVyX0Zvcm1zOiBcIjIxNTAtMjE4RlwiLFxyXG4gICAgICAgIEluQXJyb3dzOiBcIjIxOTAtMjFGRlwiLFxyXG4gICAgICAgIEluTWF0aGVtYXRpY2FsX09wZXJhdG9yczogXCIyMjAwLTIyRkZcIixcclxuICAgICAgICBJbk1pc2NlbGxhbmVvdXNfVGVjaG5pY2FsOiBcIjIzMDAtMjNGRlwiLFxyXG4gICAgICAgIEluQ29udHJvbF9QaWN0dXJlczogXCIyNDAwLTI0M0ZcIixcclxuICAgICAgICBJbk9wdGljYWxfQ2hhcmFjdGVyX1JlY29nbml0aW9uOiBcIjI0NDAtMjQ1RlwiLFxyXG4gICAgICAgIEluRW5jbG9zZWRfQWxwaGFudW1lcmljczogXCIyNDYwLTI0RkZcIixcclxuICAgICAgICBJbkJveF9EcmF3aW5nOiBcIjI1MDAtMjU3RlwiLFxyXG4gICAgICAgIEluQmxvY2tfRWxlbWVudHM6IFwiMjU4MC0yNTlGXCIsXHJcbiAgICAgICAgSW5HZW9tZXRyaWNfU2hhcGVzOiBcIjI1QTAtMjVGRlwiLFxyXG4gICAgICAgIEluTWlzY2VsbGFuZW91c19TeW1ib2xzOiBcIjI2MDAtMjZGRlwiLFxyXG4gICAgICAgIEluRGluZ2JhdHM6IFwiMjcwMC0yN0JGXCIsXHJcbiAgICAgICAgSW5NaXNjZWxsYW5lb3VzX01hdGhlbWF0aWNhbF9TeW1ib2xzX0E6IFwiMjdDMC0yN0VGXCIsXHJcbiAgICAgICAgSW5TdXBwbGVtZW50YWxfQXJyb3dzX0E6IFwiMjdGMC0yN0ZGXCIsXHJcbiAgICAgICAgSW5CcmFpbGxlX1BhdHRlcm5zOiBcIjI4MDAtMjhGRlwiLFxyXG4gICAgICAgIEluU3VwcGxlbWVudGFsX0Fycm93c19COiBcIjI5MDAtMjk3RlwiLFxyXG4gICAgICAgIEluTWlzY2VsbGFuZW91c19NYXRoZW1hdGljYWxfU3ltYm9sc19COiBcIjI5ODAtMjlGRlwiLFxyXG4gICAgICAgIEluU3VwcGxlbWVudGFsX01hdGhlbWF0aWNhbF9PcGVyYXRvcnM6IFwiMkEwMC0yQUZGXCIsXHJcbiAgICAgICAgSW5NaXNjZWxsYW5lb3VzX1N5bWJvbHNfYW5kX0Fycm93czogXCIyQjAwLTJCRkZcIixcclxuICAgICAgICBJbkdsYWdvbGl0aWM6IFwiMkMwMC0yQzVGXCIsXHJcbiAgICAgICAgSW5MYXRpbl9FeHRlbmRlZF9DOiBcIjJDNjAtMkM3RlwiLFxyXG4gICAgICAgIEluQ29wdGljOiBcIjJDODAtMkNGRlwiLFxyXG4gICAgICAgIEluR2VvcmdpYW5fU3VwcGxlbWVudDogXCIyRDAwLTJEMkZcIixcclxuICAgICAgICBJblRpZmluYWdoOiBcIjJEMzAtMkQ3RlwiLFxyXG4gICAgICAgIEluRXRoaW9waWNfRXh0ZW5kZWQ6IFwiMkQ4MC0yRERGXCIsXHJcbiAgICAgICAgSW5DeXJpbGxpY19FeHRlbmRlZF9BOiBcIjJERTAtMkRGRlwiLFxyXG4gICAgICAgIEluU3VwcGxlbWVudGFsX1B1bmN0dWF0aW9uOiBcIjJFMDAtMkU3RlwiLFxyXG4gICAgICAgIEluQ0pLX1JhZGljYWxzX1N1cHBsZW1lbnQ6IFwiMkU4MC0yRUZGXCIsXHJcbiAgICAgICAgSW5LYW5neGlfUmFkaWNhbHM6IFwiMkYwMC0yRkRGXCIsXHJcbiAgICAgICAgSW5JZGVvZ3JhcGhpY19EZXNjcmlwdGlvbl9DaGFyYWN0ZXJzOiBcIjJGRjAtMkZGRlwiLFxyXG4gICAgICAgIEluQ0pLX1N5bWJvbHNfYW5kX1B1bmN0dWF0aW9uOiBcIjMwMDAtMzAzRlwiLFxyXG4gICAgICAgIEluSGlyYWdhbmE6IFwiMzA0MC0zMDlGXCIsXHJcbiAgICAgICAgSW5LYXRha2FuYTogXCIzMEEwLTMwRkZcIixcclxuICAgICAgICBJbkJvcG9tb2ZvOiBcIjMxMDAtMzEyRlwiLFxyXG4gICAgICAgIEluSGFuZ3VsX0NvbXBhdGliaWxpdHlfSmFtbzogXCIzMTMwLTMxOEZcIixcclxuICAgICAgICBJbkthbmJ1bjogXCIzMTkwLTMxOUZcIixcclxuICAgICAgICBJbkJvcG9tb2ZvX0V4dGVuZGVkOiBcIjMxQTAtMzFCRlwiLFxyXG4gICAgICAgIEluQ0pLX1N0cm9rZXM6IFwiMzFDMC0zMUVGXCIsXHJcbiAgICAgICAgSW5LYXRha2FuYV9QaG9uZXRpY19FeHRlbnNpb25zOiBcIjMxRjAtMzFGRlwiLFxyXG4gICAgICAgIEluRW5jbG9zZWRfQ0pLX0xldHRlcnNfYW5kX01vbnRoczogXCIzMjAwLTMyRkZcIixcclxuICAgICAgICBJbkNKS19Db21wYXRpYmlsaXR5OiBcIjMzMDAtMzNGRlwiLFxyXG4gICAgICAgIEluQ0pLX1VuaWZpZWRfSWRlb2dyYXBoc19FeHRlbnNpb25fQTogXCIzNDAwLTREQkZcIixcclxuICAgICAgICBJbllpamluZ19IZXhhZ3JhbV9TeW1ib2xzOiBcIjREQzAtNERGRlwiLFxyXG4gICAgICAgIEluQ0pLX1VuaWZpZWRfSWRlb2dyYXBoczogXCI0RTAwLTlGRkZcIixcclxuICAgICAgICBJbllpX1N5bGxhYmxlczogXCJBMDAwLUE0OEZcIixcclxuICAgICAgICBJbllpX1JhZGljYWxzOiBcIkE0OTAtQTRDRlwiLFxyXG4gICAgICAgIEluTGlzdTogXCJBNEQwLUE0RkZcIixcclxuICAgICAgICBJblZhaTogXCJBNTAwLUE2M0ZcIixcclxuICAgICAgICBJbkN5cmlsbGljX0V4dGVuZGVkX0I6IFwiQTY0MC1BNjlGXCIsXHJcbiAgICAgICAgSW5CYW11bTogXCJBNkEwLUE2RkZcIixcclxuICAgICAgICBJbk1vZGlmaWVyX1RvbmVfTGV0dGVyczogXCJBNzAwLUE3MUZcIixcclxuICAgICAgICBJbkxhdGluX0V4dGVuZGVkX0Q6IFwiQTcyMC1BN0ZGXCIsXHJcbiAgICAgICAgSW5TeWxvdGlfTmFncmk6IFwiQTgwMC1BODJGXCIsXHJcbiAgICAgICAgSW5Db21tb25fSW5kaWNfTnVtYmVyX0Zvcm1zOiBcIkE4MzAtQTgzRlwiLFxyXG4gICAgICAgIEluUGhhZ3NfcGE6IFwiQTg0MC1BODdGXCIsXHJcbiAgICAgICAgSW5TYXVyYXNodHJhOiBcIkE4ODAtQThERlwiLFxyXG4gICAgICAgIEluRGV2YW5hZ2FyaV9FeHRlbmRlZDogXCJBOEUwLUE4RkZcIixcclxuICAgICAgICBJbktheWFoX0xpOiBcIkE5MDAtQTkyRlwiLFxyXG4gICAgICAgIEluUmVqYW5nOiBcIkE5MzAtQTk1RlwiLFxyXG4gICAgICAgIEluSGFuZ3VsX0phbW9fRXh0ZW5kZWRfQTogXCJBOTYwLUE5N0ZcIixcclxuICAgICAgICBJbkphdmFuZXNlOiBcIkE5ODAtQTlERlwiLFxyXG4gICAgICAgIEluQ2hhbTogXCJBQTAwLUFBNUZcIixcclxuICAgICAgICBJbk15YW5tYXJfRXh0ZW5kZWRfQTogXCJBQTYwLUFBN0ZcIixcclxuICAgICAgICBJblRhaV9WaWV0OiBcIkFBODAtQUFERlwiLFxyXG4gICAgICAgIEluTWVldGVpX01heWVrX0V4dGVuc2lvbnM6IFwiQUFFMC1BQUZGXCIsXHJcbiAgICAgICAgSW5FdGhpb3BpY19FeHRlbmRlZF9BOiBcIkFCMDAtQUIyRlwiLFxyXG4gICAgICAgIEluTWVldGVpX01heWVrOiBcIkFCQzAtQUJGRlwiLFxyXG4gICAgICAgIEluSGFuZ3VsX1N5bGxhYmxlczogXCJBQzAwLUQ3QUZcIixcclxuICAgICAgICBJbkhhbmd1bF9KYW1vX0V4dGVuZGVkX0I6IFwiRDdCMC1EN0ZGXCIsXHJcbiAgICAgICAgSW5IaWdoX1N1cnJvZ2F0ZXM6IFwiRDgwMC1EQjdGXCIsXHJcbiAgICAgICAgSW5IaWdoX1ByaXZhdGVfVXNlX1N1cnJvZ2F0ZXM6IFwiREI4MC1EQkZGXCIsXHJcbiAgICAgICAgSW5Mb3dfU3Vycm9nYXRlczogXCJEQzAwLURGRkZcIixcclxuICAgICAgICBJblByaXZhdGVfVXNlX0FyZWE6IFwiRTAwMC1GOEZGXCIsXHJcbiAgICAgICAgSW5DSktfQ29tcGF0aWJpbGl0eV9JZGVvZ3JhcGhzOiBcIkY5MDAtRkFGRlwiLFxyXG4gICAgICAgIEluQWxwaGFiZXRpY19QcmVzZW50YXRpb25fRm9ybXM6IFwiRkIwMC1GQjRGXCIsXHJcbiAgICAgICAgSW5BcmFiaWNfUHJlc2VudGF0aW9uX0Zvcm1zX0E6IFwiRkI1MC1GREZGXCIsXHJcbiAgICAgICAgSW5WYXJpYXRpb25fU2VsZWN0b3JzOiBcIkZFMDAtRkUwRlwiLFxyXG4gICAgICAgIEluVmVydGljYWxfRm9ybXM6IFwiRkUxMC1GRTFGXCIsXHJcbiAgICAgICAgSW5Db21iaW5pbmdfSGFsZl9NYXJrczogXCJGRTIwLUZFMkZcIixcclxuICAgICAgICBJbkNKS19Db21wYXRpYmlsaXR5X0Zvcm1zOiBcIkZFMzAtRkU0RlwiLFxyXG4gICAgICAgIEluU21hbGxfRm9ybV9WYXJpYW50czogXCJGRTUwLUZFNkZcIixcclxuICAgICAgICBJbkFyYWJpY19QcmVzZW50YXRpb25fRm9ybXNfQjogXCJGRTcwLUZFRkZcIixcclxuICAgICAgICBJbkhhbGZ3aWR0aF9hbmRfRnVsbHdpZHRoX0Zvcm1zOiBcIkZGMDAtRkZFRlwiLFxyXG4gICAgICAgIEluU3BlY2lhbHM6IFwiRkZGMC1GRkZGXCJcclxuICAgIH0pO1xyXG5cclxufShYUmVnRXhwKSk7XHJcblxyXG5cbi8qKioqKiB1bmljb2RlLXByb3BlcnRpZXMuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwIFVuaWNvZGUgUHJvcGVydGllcyB2MS4wLjBcclxuICogKGMpIDIwMTIgU3RldmVuIExldml0aGFuIDxodHRwOi8veHJlZ2V4cC5jb20vPlxyXG4gKiBNSVQgTGljZW5zZVxyXG4gKiBVc2VzIFVuaWNvZGUgNi4xIDxodHRwOi8vdW5pY29kZS5vcmcvPlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBZGRzIFVuaWNvZGUgcHJvcGVydGllcyBuZWNlc3NhcnkgdG8gbWVldCBMZXZlbCAxIFVuaWNvZGUgc3VwcG9ydCAoZGV0YWlsZWQgaW4gVVRTIzE4IFJMMS4yKS5cclxuICogSW5jbHVkZXMgY29kZSBwb2ludHMgZnJvbSB0aGUgQmFzaWMgTXVsdGlsaW5ndWFsIFBsYW5lIChVKzAwMDAtVStGRkZGKSBvbmx5LiBUb2tlbiBuYW1lcyBhcmVcclxuICogY2FzZSBpbnNlbnNpdGl2ZSwgYW5kIGFueSBzcGFjZXMsIGh5cGhlbnMsIGFuZCB1bmRlcnNjb3JlcyBhcmUgaWdub3JlZC5cclxuICogQHJlcXVpcmVzIFhSZWdFeHAsIFhSZWdFeHAgVW5pY29kZSBCYXNlXHJcbiAqL1xyXG4oZnVuY3Rpb24gKFhSZWdFeHApIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIGlmICghWFJlZ0V4cC5hZGRVbmljb2RlUGFja2FnZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcIlVuaWNvZGUgQmFzZSBtdXN0IGJlIGxvYWRlZCBiZWZvcmUgVW5pY29kZSBQcm9wZXJ0aWVzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIFhSZWdFeHAuaW5zdGFsbChcImV4dGVuc2liaWxpdHlcIik7XHJcblxyXG4gICAgWFJlZ0V4cC5hZGRVbmljb2RlUGFja2FnZSh7XHJcbiAgICAgICAgQWxwaGFiZXRpYzogXCIwMDQxLTAwNUEwMDYxLTAwN0EwMEFBMDBCNTAwQkEwMEMwLTAwRDYwMEQ4LTAwRjYwMEY4LTAyQzEwMkM2LTAyRDEwMkUwLTAyRTQwMkVDMDJFRTAzNDUwMzcwLTAzNzQwMzc2MDM3NzAzN0EtMDM3RDAzODYwMzg4LTAzOEEwMzhDMDM4RS0wM0ExMDNBMy0wM0Y1MDNGNy0wNDgxMDQ4QS0wNTI3MDUzMS0wNTU2MDU1OTA1NjEtMDU4NzA1QjAtMDVCRDA1QkYwNUMxMDVDMjA1QzQwNUM1MDVDNzA1RDAtMDVFQTA1RjAtMDVGMjA2MTAtMDYxQTA2MjAtMDY1NzA2NTktMDY1RjA2NkUtMDZEMzA2RDUtMDZEQzA2RTEtMDZFODA2RUQtMDZFRjA2RkEtMDZGQzA2RkYwNzEwLTA3M0YwNzRELTA3QjEwN0NBLTA3RUEwN0Y0MDdGNTA3RkEwODAwLTA4MTcwODFBLTA4MkMwODQwLTA4NTgwOEEwMDhBMi0wOEFDMDhFNC0wOEU5MDhGMC0wOEZFMDkwMC0wOTNCMDkzRC0wOTRDMDk0RS0wOTUwMDk1NS0wOTYzMDk3MS0wOTc3MDk3OS0wOTdGMDk4MS0wOTgzMDk4NS0wOThDMDk4RjA5OTAwOTkzLTA5QTgwOUFBLTA5QjAwOUIyMDlCNi0wOUI5MDlCRC0wOUM0MDlDNzA5QzgwOUNCMDlDQzA5Q0UwOUQ3MDlEQzA5REQwOURGLTA5RTMwOUYwMDlGMTBBMDEtMEEwMzBBMDUtMEEwQTBBMEYwQTEwMEExMy0wQTI4MEEyQS0wQTMwMEEzMjBBMzMwQTM1MEEzNjBBMzgwQTM5MEEzRS0wQTQyMEE0NzBBNDgwQTRCMEE0QzBBNTEwQTU5LTBBNUMwQTVFMEE3MC0wQTc1MEE4MS0wQTgzMEE4NS0wQThEMEE4Ri0wQTkxMEE5My0wQUE4MEFBQS0wQUIwMEFCMjBBQjMwQUI1LTBBQjkwQUJELTBBQzUwQUM3LTBBQzkwQUNCMEFDQzBBRDAwQUUwLTBBRTMwQjAxLTBCMDMwQjA1LTBCMEMwQjBGMEIxMDBCMTMtMEIyODBCMkEtMEIzMDBCMzIwQjMzMEIzNS0wQjM5MEIzRC0wQjQ0MEI0NzBCNDgwQjRCMEI0QzBCNTYwQjU3MEI1QzBCNUQwQjVGLTBCNjMwQjcxMEI4MjBCODMwQjg1LTBCOEEwQjhFLTBCOTAwQjkyLTBCOTUwQjk5MEI5QTBCOUMwQjlFMEI5RjBCQTMwQkE0MEJBOC0wQkFBMEJBRS0wQkI5MEJCRS0wQkMyMEJDNi0wQkM4MEJDQS0wQkNDMEJEMDBCRDcwQzAxLTBDMDMwQzA1LTBDMEMwQzBFLTBDMTAwQzEyLTBDMjgwQzJBLTBDMzMwQzM1LTBDMzkwQzNELTBDNDQwQzQ2LTBDNDgwQzRBLTBDNEMwQzU1MEM1NjBDNTgwQzU5MEM2MC0wQzYzMEM4MjBDODMwQzg1LTBDOEMwQzhFLTBDOTAwQzkyLTBDQTgwQ0FBLTBDQjMwQ0I1LTBDQjkwQ0JELTBDQzQwQ0M2LTBDQzgwQ0NBLTBDQ0MwQ0Q1MENENjBDREUwQ0UwLTBDRTMwQ0YxMENGMjBEMDIwRDAzMEQwNS0wRDBDMEQwRS0wRDEwMEQxMi0wRDNBMEQzRC0wRDQ0MEQ0Ni0wRDQ4MEQ0QS0wRDRDMEQ0RTBENTcwRDYwLTBENjMwRDdBLTBEN0YwRDgyMEQ4MzBEODUtMEQ5NjBEOUEtMERCMTBEQjMtMERCQjBEQkQwREMwLTBEQzYwRENGLTBERDQwREQ2MEREOC0wRERGMERGMjBERjMwRTAxLTBFM0EwRTQwLTBFNDYwRTREMEU4MTBFODIwRTg0MEU4NzBFODgwRThBMEU4RDBFOTQtMEU5NzBFOTktMEU5RjBFQTEtMEVBMzBFQTUwRUE3MEVBQTBFQUIwRUFELTBFQjkwRUJCLTBFQkQwRUMwLTBFQzQwRUM2MEVDRDBFREMtMEVERjBGMDAwRjQwLTBGNDcwRjQ5LTBGNkMwRjcxLTBGODEwRjg4LTBGOTcwRjk5LTBGQkMxMDAwLTEwMzYxMDM4MTAzQi0xMDNGMTA1MC0xMDYyMTA2NS0xMDY4MTA2RS0xMDg2MTA4RTEwOUMxMDlEMTBBMC0xMEM1MTBDNzEwQ0QxMEQwLTEwRkExMEZDLTEyNDgxMjRBLTEyNEQxMjUwLTEyNTYxMjU4MTI1QS0xMjVEMTI2MC0xMjg4MTI4QS0xMjhEMTI5MC0xMkIwMTJCMi0xMkI1MTJCOC0xMkJFMTJDMDEyQzItMTJDNTEyQzgtMTJENjEyRDgtMTMxMDEzMTItMTMxNTEzMTgtMTM1QTEzNUYxMzgwLTEzOEYxM0EwLTEzRjQxNDAxLTE2NkMxNjZGLTE2N0YxNjgxLTE2OUExNkEwLTE2RUExNkVFLTE2RjAxNzAwLTE3MEMxNzBFLTE3MTMxNzIwLTE3MzMxNzQwLTE3NTMxNzYwLTE3NkMxNzZFLTE3NzAxNzcyMTc3MzE3ODAtMTdCMzE3QjYtMTdDODE3RDcxN0RDMTgyMC0xODc3MTg4MC0xOEFBMThCMC0xOEY1MTkwMC0xOTFDMTkyMC0xOTJCMTkzMC0xOTM4MTk1MC0xOTZEMTk3MC0xOTc0MTk4MC0xOUFCMTlCMC0xOUM5MUEwMC0xQTFCMUEyMC0xQTVFMUE2MS0xQTc0MUFBNzFCMDAtMUIzMzFCMzUtMUI0MzFCNDUtMUI0QjFCODAtMUJBOTFCQUMtMUJBRjFCQkEtMUJFNTFCRTctMUJGMTFDMDAtMUMzNTFDNEQtMUM0RjFDNUEtMUM3RDFDRTktMUNFQzFDRUUtMUNGMzFDRjUxQ0Y2MUQwMC0xREJGMUUwMC0xRjE1MUYxOC0xRjFEMUYyMC0xRjQ1MUY0OC0xRjREMUY1MC0xRjU3MUY1OTFGNUIxRjVEMUY1Ri0xRjdEMUY4MC0xRkI0MUZCNi0xRkJDMUZCRTFGQzItMUZDNDFGQzYtMUZDQzFGRDAtMUZEMzFGRDYtMUZEQjFGRTAtMUZFQzFGRjItMUZGNDFGRjYtMUZGQzIwNzEyMDdGMjA5MC0yMDlDMjEwMjIxMDcyMTBBLTIxMTMyMTE1MjExOS0yMTFEMjEyNDIxMjYyMTI4MjEyQS0yMTJEMjEyRi0yMTM5MjEzQy0yMTNGMjE0NS0yMTQ5MjE0RTIxNjAtMjE4ODI0QjYtMjRFOTJDMDAtMkMyRTJDMzAtMkM1RTJDNjAtMkNFNDJDRUItMkNFRTJDRjIyQ0YzMkQwMC0yRDI1MkQyNzJEMkQyRDMwLTJENjcyRDZGMkQ4MC0yRDk2MkRBMC0yREE2MkRBOC0yREFFMkRCMC0yREI2MkRCOC0yREJFMkRDMC0yREM2MkRDOC0yRENFMkREMC0yREQ2MkREOC0yRERFMkRFMC0yREZGMkUyRjMwMDUtMzAwNzMwMjEtMzAyOTMwMzEtMzAzNTMwMzgtMzAzQzMwNDEtMzA5NjMwOUQtMzA5RjMwQTEtMzBGQTMwRkMtMzBGRjMxMDUtMzEyRDMxMzEtMzE4RTMxQTAtMzFCQTMxRjAtMzFGRjM0MDAtNERCNTRFMDAtOUZDQ0EwMDAtQTQ4Q0E0RDAtQTRGREE1MDAtQTYwQ0E2MTAtQTYxRkE2MkFBNjJCQTY0MC1BNjZFQTY3NC1BNjdCQTY3Ri1BNjk3QTY5Ri1BNkVGQTcxNy1BNzFGQTcyMi1BNzg4QTc4Qi1BNzhFQTc5MC1BNzkzQTdBMC1BN0FBQTdGOC1BODAxQTgwMy1BODA1QTgwNy1BODBBQTgwQy1BODI3QTg0MC1BODczQTg4MC1BOEMzQThGMi1BOEY3QThGQkE5MEEtQTkyQUE5MzAtQTk1MkE5NjAtQTk3Q0E5ODAtQTlCMkE5QjQtQTlCRkE5Q0ZBQTAwLUFBMzZBQTQwLUFBNERBQTYwLUFBNzZBQTdBQUE4MC1BQUJFQUFDMEFBQzJBQURCLUFBRERBQUUwLUFBRUZBQUYyLUFBRjVBQjAxLUFCMDZBQjA5LUFCMEVBQjExLUFCMTZBQjIwLUFCMjZBQjI4LUFCMkVBQkMwLUFCRUFBQzAwLUQ3QTNEN0IwLUQ3QzZEN0NCLUQ3RkJGOTAwLUZBNkRGQTcwLUZBRDlGQjAwLUZCMDZGQjEzLUZCMTdGQjFELUZCMjhGQjJBLUZCMzZGQjM4LUZCM0NGQjNFRkI0MEZCNDFGQjQzRkI0NEZCNDYtRkJCMUZCRDMtRkQzREZENTAtRkQ4RkZEOTItRkRDN0ZERjAtRkRGQkZFNzAtRkU3NEZFNzYtRkVGQ0ZGMjEtRkYzQUZGNDEtRkY1QUZGNjYtRkZCRUZGQzItRkZDN0ZGQ0EtRkZDRkZGRDItRkZEN0ZGREEtRkZEQ1wiLFxyXG4gICAgICAgIFVwcGVyY2FzZTogXCIwMDQxLTAwNUEwMEMwLTAwRDYwMEQ4LTAwREUwMTAwMDEwMjAxMDQwMTA2MDEwODAxMEEwMTBDMDEwRTAxMTAwMTEyMDExNDAxMTYwMTE4MDExQTAxMUMwMTFFMDEyMDAxMjIwMTI0MDEyNjAxMjgwMTJBMDEyQzAxMkUwMTMwMDEzMjAxMzQwMTM2MDEzOTAxM0IwMTNEMDEzRjAxNDEwMTQzMDE0NTAxNDcwMTRBMDE0QzAxNEUwMTUwMDE1MjAxNTQwMTU2MDE1ODAxNUEwMTVDMDE1RTAxNjAwMTYyMDE2NDAxNjYwMTY4MDE2QTAxNkMwMTZFMDE3MDAxNzIwMTc0MDE3NjAxNzgwMTc5MDE3QjAxN0QwMTgxMDE4MjAxODQwMTg2MDE4NzAxODktMDE4QjAxOEUtMDE5MTAxOTMwMTk0MDE5Ni0wMTk4MDE5QzAxOUQwMTlGMDFBMDAxQTIwMUE0MDFBNjAxQTcwMUE5MDFBQzAxQUUwMUFGMDFCMS0wMUIzMDFCNTAxQjcwMUI4MDFCQzAxQzQwMUM3MDFDQTAxQ0QwMUNGMDFEMTAxRDMwMUQ1MDFENzAxRDkwMURCMDFERTAxRTAwMUUyMDFFNDAxRTYwMUU4MDFFQTAxRUMwMUVFMDFGMTAxRjQwMUY2LTAxRjgwMUZBMDFGQzAxRkUwMjAwMDIwMjAyMDQwMjA2MDIwODAyMEEwMjBDMDIwRTAyMTAwMjEyMDIxNDAyMTYwMjE4MDIxQTAyMUMwMjFFMDIyMDAyMjIwMjI0MDIyNjAyMjgwMjJBMDIyQzAyMkUwMjMwMDIzMjAyM0EwMjNCMDIzRDAyM0UwMjQxMDI0My0wMjQ2MDI0ODAyNEEwMjRDMDI0RTAzNzAwMzcyMDM3NjAzODYwMzg4LTAzOEEwMzhDMDM4RTAzOEYwMzkxLTAzQTEwM0EzLTAzQUIwM0NGMDNEMi0wM0Q0MDNEODAzREEwM0RDMDNERTAzRTAwM0UyMDNFNDAzRTYwM0U4MDNFQTAzRUMwM0VFMDNGNDAzRjcwM0Y5MDNGQTAzRkQtMDQyRjA0NjAwNDYyMDQ2NDA0NjYwNDY4MDQ2QTA0NkMwNDZFMDQ3MDA0NzIwNDc0MDQ3NjA0NzgwNDdBMDQ3QzA0N0UwNDgwMDQ4QTA0OEMwNDhFMDQ5MDA0OTIwNDk0MDQ5NjA0OTgwNDlBMDQ5QzA0OUUwNEEwMDRBMjA0QTQwNEE2MDRBODA0QUEwNEFDMDRBRTA0QjAwNEIyMDRCNDA0QjYwNEI4MDRCQTA0QkMwNEJFMDRDMDA0QzEwNEMzMDRDNTA0QzcwNEM5MDRDQjA0Q0QwNEQwMDREMjA0RDQwNEQ2MDREODA0REEwNERDMDRERTA0RTAwNEUyMDRFNDA0RTYwNEU4MDRFQTA0RUMwNEVFMDRGMDA0RjIwNEY0MDRGNjA0RjgwNEZBMDRGQzA0RkUwNTAwMDUwMjA1MDQwNTA2MDUwODA1MEEwNTBDMDUwRTA1MTAwNTEyMDUxNDA1MTYwNTE4MDUxQTA1MUMwNTFFMDUyMDA1MjIwNTI0MDUyNjA1MzEtMDU1NjEwQTAtMTBDNTEwQzcxMENEMUUwMDFFMDIxRTA0MUUwNjFFMDgxRTBBMUUwQzFFMEUxRTEwMUUxMjFFMTQxRTE2MUUxODFFMUExRTFDMUUxRTFFMjAxRTIyMUUyNDFFMjYxRTI4MUUyQTFFMkMxRTJFMUUzMDFFMzIxRTM0MUUzNjFFMzgxRTNBMUUzQzFFM0UxRTQwMUU0MjFFNDQxRTQ2MUU0ODFFNEExRTRDMUU0RTFFNTAxRTUyMUU1NDFFNTYxRTU4MUU1QTFFNUMxRTVFMUU2MDFFNjIxRTY0MUU2NjFFNjgxRTZBMUU2QzFFNkUxRTcwMUU3MjFFNzQxRTc2MUU3ODFFN0ExRTdDMUU3RTFFODAxRTgyMUU4NDFFODYxRTg4MUU4QTFFOEMxRThFMUU5MDFFOTIxRTk0MUU5RTFFQTAxRUEyMUVBNDFFQTYxRUE4MUVBQTFFQUMxRUFFMUVCMDFFQjIxRUI0MUVCNjFFQjgxRUJBMUVCQzFFQkUxRUMwMUVDMjFFQzQxRUM2MUVDODFFQ0ExRUNDMUVDRTFFRDAxRUQyMUVENDFFRDYxRUQ4MUVEQTFFREMxRURFMUVFMDFFRTIxRUU0MUVFNjFFRTgxRUVBMUVFQzFFRUUxRUYwMUVGMjFFRjQxRUY2MUVGODFFRkExRUZDMUVGRTFGMDgtMUYwRjFGMTgtMUYxRDFGMjgtMUYyRjFGMzgtMUYzRjFGNDgtMUY0RDFGNTkxRjVCMUY1RDFGNUYxRjY4LTFGNkYxRkI4LTFGQkIxRkM4LTFGQ0IxRkQ4LTFGREIxRkU4LTFGRUMxRkY4LTFGRkIyMTAyMjEwNzIxMEItMjEwRDIxMTAtMjExMjIxMTUyMTE5LTIxMUQyMTI0MjEyNjIxMjgyMTJBLTIxMkQyMTMwLTIxMzMyMTNFMjEzRjIxNDUyMTYwLTIxNkYyMTgzMjRCNi0yNENGMkMwMC0yQzJFMkM2MDJDNjItMkM2NDJDNjcyQzY5MkM2QjJDNkQtMkM3MDJDNzIyQzc1MkM3RS0yQzgwMkM4MjJDODQyQzg2MkM4ODJDOEEyQzhDMkM4RTJDOTAyQzkyMkM5NDJDOTYyQzk4MkM5QTJDOUMyQzlFMkNBMDJDQTIyQ0E0MkNBNjJDQTgyQ0FBMkNBQzJDQUUyQ0IwMkNCMjJDQjQyQ0I2MkNCODJDQkEyQ0JDMkNCRTJDQzAyQ0MyMkNDNDJDQzYyQ0M4MkNDQTJDQ0MyQ0NFMkNEMDJDRDIyQ0Q0MkNENjJDRDgyQ0RBMkNEQzJDREUyQ0UwMkNFMjJDRUIyQ0VEMkNGMkE2NDBBNjQyQTY0NEE2NDZBNjQ4QTY0QUE2NENBNjRFQTY1MEE2NTJBNjU0QTY1NkE2NThBNjVBQTY1Q0E2NUVBNjYwQTY2MkE2NjRBNjY2QTY2OEE2NkFBNjZDQTY4MEE2ODJBNjg0QTY4NkE2ODhBNjhBQTY4Q0E2OEVBNjkwQTY5MkE2OTRBNjk2QTcyMkE3MjRBNzI2QTcyOEE3MkFBNzJDQTcyRUE3MzJBNzM0QTczNkE3MzhBNzNBQTczQ0E3M0VBNzQwQTc0MkE3NDRBNzQ2QTc0OEE3NEFBNzRDQTc0RUE3NTBBNzUyQTc1NEE3NTZBNzU4QTc1QUE3NUNBNzVFQTc2MEE3NjJBNzY0QTc2NkE3NjhBNzZBQTc2Q0E3NkVBNzc5QTc3QkE3N0RBNzdFQTc4MEE3ODJBNzg0QTc4NkE3OEJBNzhEQTc5MEE3OTJBN0EwQTdBMkE3QTRBN0E2QTdBOEE3QUFGRjIxLUZGM0FcIixcclxuICAgICAgICBMb3dlcmNhc2U6IFwiMDA2MS0wMDdBMDBBQTAwQjUwMEJBMDBERi0wMEY2MDBGOC0wMEZGMDEwMTAxMDMwMTA1MDEwNzAxMDkwMTBCMDEwRDAxMEYwMTExMDExMzAxMTUwMTE3MDExOTAxMUIwMTFEMDExRjAxMjEwMTIzMDEyNTAxMjcwMTI5MDEyQjAxMkQwMTJGMDEzMTAxMzMwMTM1MDEzNzAxMzgwMTNBMDEzQzAxM0UwMTQwMDE0MjAxNDQwMTQ2MDE0ODAxNDkwMTRCMDE0RDAxNEYwMTUxMDE1MzAxNTUwMTU3MDE1OTAxNUIwMTVEMDE1RjAxNjEwMTYzMDE2NTAxNjcwMTY5MDE2QjAxNkQwMTZGMDE3MTAxNzMwMTc1MDE3NzAxN0EwMTdDMDE3RS0wMTgwMDE4MzAxODUwMTg4MDE4QzAxOEQwMTkyMDE5NTAxOTktMDE5QjAxOUUwMUExMDFBMzAxQTUwMUE4MDFBQTAxQUIwMUFEMDFCMDAxQjQwMUI2MDFCOTAxQkEwMUJELTAxQkYwMUM2MDFDOTAxQ0MwMUNFMDFEMDAxRDIwMUQ0MDFENjAxRDgwMURBMDFEQzAxREQwMURGMDFFMTAxRTMwMUU1MDFFNzAxRTkwMUVCMDFFRDAxRUYwMUYwMDFGMzAxRjUwMUY5MDFGQjAxRkQwMUZGMDIwMTAyMDMwMjA1MDIwNzAyMDkwMjBCMDIwRDAyMEYwMjExMDIxMzAyMTUwMjE3MDIxOTAyMUIwMjFEMDIxRjAyMjEwMjIzMDIyNTAyMjcwMjI5MDIyQjAyMkQwMjJGMDIzMTAyMzMtMDIzOTAyM0MwMjNGMDI0MDAyNDIwMjQ3MDI0OTAyNEIwMjREMDI0Ri0wMjkzMDI5NS0wMkI4MDJDMDAyQzEwMkUwLTAyRTQwMzQ1MDM3MTAzNzMwMzc3MDM3QS0wMzdEMDM5MDAzQUMtMDNDRTAzRDAwM0QxMDNENS0wM0Q3MDNEOTAzREIwM0REMDNERjAzRTEwM0UzMDNFNTAzRTcwM0U5MDNFQjAzRUQwM0VGLTAzRjMwM0Y1MDNGODAzRkIwM0ZDMDQzMC0wNDVGMDQ2MTA0NjMwNDY1MDQ2NzA0NjkwNDZCMDQ2RDA0NkYwNDcxMDQ3MzA0NzUwNDc3MDQ3OTA0N0IwNDdEMDQ3RjA0ODEwNDhCMDQ4RDA0OEYwNDkxMDQ5MzA0OTUwNDk3MDQ5OTA0OUIwNDlEMDQ5RjA0QTEwNEEzMDRBNTA0QTcwNEE5MDRBQjA0QUQwNEFGMDRCMTA0QjMwNEI1MDRCNzA0QjkwNEJCMDRCRDA0QkYwNEMyMDRDNDA0QzYwNEM4MDRDQTA0Q0MwNENFMDRDRjA0RDEwNEQzMDRENTA0RDcwNEQ5MDREQjA0REQwNERGMDRFMTA0RTMwNEU1MDRFNzA0RTkwNEVCMDRFRDA0RUYwNEYxMDRGMzA0RjUwNEY3MDRGOTA0RkIwNEZEMDRGRjA1MDEwNTAzMDUwNTA1MDcwNTA5MDUwQjA1MEQwNTBGMDUxMTA1MTMwNTE1MDUxNzA1MTkwNTFCMDUxRDA1MUYwNTIxMDUyMzA1MjUwNTI3MDU2MS0wNTg3MUQwMC0xREJGMUUwMTFFMDMxRTA1MUUwNzFFMDkxRTBCMUUwRDFFMEYxRTExMUUxMzFFMTUxRTE3MUUxOTFFMUIxRTFEMUUxRjFFMjExRTIzMUUyNTFFMjcxRTI5MUUyQjFFMkQxRTJGMUUzMTFFMzMxRTM1MUUzNzFFMzkxRTNCMUUzRDFFM0YxRTQxMUU0MzFFNDUxRTQ3MUU0OTFFNEIxRTREMUU0RjFFNTExRTUzMUU1NTFFNTcxRTU5MUU1QjFFNUQxRTVGMUU2MTFFNjMxRTY1MUU2NzFFNjkxRTZCMUU2RDFFNkYxRTcxMUU3MzFFNzUxRTc3MUU3OTFFN0IxRTdEMUU3RjFFODExRTgzMUU4NTFFODcxRTg5MUU4QjFFOEQxRThGMUU5MTFFOTMxRTk1LTFFOUQxRTlGMUVBMTFFQTMxRUE1MUVBNzFFQTkxRUFCMUVBRDFFQUYxRUIxMUVCMzFFQjUxRUI3MUVCOTFFQkIxRUJEMUVCRjFFQzExRUMzMUVDNTFFQzcxRUM5MUVDQjFFQ0QxRUNGMUVEMTFFRDMxRUQ1MUVENzFFRDkxRURCMUVERDFFREYxRUUxMUVFMzFFRTUxRUU3MUVFOTFFRUIxRUVEMUVFRjFFRjExRUYzMUVGNTFFRjcxRUY5MUVGQjFFRkQxRUZGLTFGMDcxRjEwLTFGMTUxRjIwLTFGMjcxRjMwLTFGMzcxRjQwLTFGNDUxRjUwLTFGNTcxRjYwLTFGNjcxRjcwLTFGN0QxRjgwLTFGODcxRjkwLTFGOTcxRkEwLTFGQTcxRkIwLTFGQjQxRkI2MUZCNzFGQkUxRkMyLTFGQzQxRkM2MUZDNzFGRDAtMUZEMzFGRDYxRkQ3MUZFMC0xRkU3MUZGMi0xRkY0MUZGNjFGRjcyMDcxMjA3RjIwOTAtMjA5QzIxMEEyMTBFMjEwRjIxMTMyMTJGMjEzNDIxMzkyMTNDMjEzRDIxNDYtMjE0OTIxNEUyMTcwLTIxN0YyMTg0MjREMC0yNEU5MkMzMC0yQzVFMkM2MTJDNjUyQzY2MkM2ODJDNkEyQzZDMkM3MTJDNzMyQzc0MkM3Ni0yQzdEMkM4MTJDODMyQzg1MkM4NzJDODkyQzhCMkM4RDJDOEYyQzkxMkM5MzJDOTUyQzk3MkM5OTJDOUIyQzlEMkM5RjJDQTEyQ0EzMkNBNTJDQTcyQ0E5MkNBQjJDQUQyQ0FGMkNCMTJDQjMyQ0I1MkNCNzJDQjkyQ0JCMkNCRDJDQkYyQ0MxMkNDMzJDQzUyQ0M3MkNDOTJDQ0IyQ0NEMkNDRjJDRDEyQ0QzMkNENTJDRDcyQ0Q5MkNEQjJDREQyQ0RGMkNFMTJDRTMyQ0U0MkNFQzJDRUUyQ0YzMkQwMC0yRDI1MkQyNzJEMkRBNjQxQTY0M0E2NDVBNjQ3QTY0OUE2NEJBNjREQTY0RkE2NTFBNjUzQTY1NUE2NTdBNjU5QTY1QkE2NURBNjVGQTY2MUE2NjNBNjY1QTY2N0E2NjlBNjZCQTY2REE2ODFBNjgzQTY4NUE2ODdBNjg5QTY4QkE2OERBNjhGQTY5MUE2OTNBNjk1QTY5N0E3MjNBNzI1QTcyN0E3MjlBNzJCQTcyREE3MkYtQTczMUE3MzNBNzM1QTczN0E3MzlBNzNCQTczREE3M0ZBNzQxQTc0M0E3NDVBNzQ3QTc0OUE3NEJBNzREQTc0RkE3NTFBNzUzQTc1NUE3NTdBNzU5QTc1QkE3NURBNzVGQTc2MUE3NjNBNzY1QTc2N0E3NjlBNzZCQTc2REE3NkYtQTc3OEE3N0FBNzdDQTc3RkE3ODFBNzgzQTc4NUE3ODdBNzhDQTc4RUE3OTFBNzkzQTdBMUE3QTNBN0E1QTdBN0E3QTlBN0Y4LUE3RkFGQjAwLUZCMDZGQjEzLUZCMTdGRjQxLUZGNUFcIixcclxuICAgICAgICBXaGl0ZV9TcGFjZTogXCIwMDA5LTAwMEQwMDIwMDA4NTAwQTAxNjgwMTgwRTIwMDAtMjAwQTIwMjgyMDI5MjAyRjIwNUYzMDAwXCIsXHJcbiAgICAgICAgTm9uY2hhcmFjdGVyX0NvZGVfUG9pbnQ6IFwiRkREMC1GREVGRkZGRUZGRkZcIixcclxuICAgICAgICBEZWZhdWx0X0lnbm9yYWJsZV9Db2RlX1BvaW50OiBcIjAwQUQwMzRGMTE1RjExNjAxN0I0MTdCNTE4MEItMTgwRDIwMEItMjAwRjIwMkEtMjAyRTIwNjAtMjA2RjMxNjRGRTAwLUZFMEZGRUZGRkZBMEZGRjAtRkZGOFwiLFxyXG4gICAgICAgIC8vIFxccHtBbnl9IG1hdGNoZXMgYSBjb2RlIHVuaXQuIFRvIG1hdGNoIGFueSBjb2RlIHBvaW50IHZpYSBzdXJyb2dhdGUgcGFpcnMsIHVzZSAoPzpbXFwwLVxcdUQ3RkZcXHVEQzAwLVxcdUZGRkZdfFtcXHVEODAwLVxcdURCRkZdW1xcdURDMDAtXFx1REZGRl18W1xcdUQ4MDAtXFx1REJGRl0pXHJcbiAgICAgICAgQW55OiBcIjAwMDAtRkZGRlwiLCAvLyBcXHB7XkFueX0gY29tcGlsZXMgdG8gW15cXHUwMDAwLVxcdUZGRkZdOyBbXFxwe15Bbnl9XSB0byBbXVxyXG4gICAgICAgIEFzY2lpOiBcIjAwMDAtMDA3RlwiLFxyXG4gICAgICAgIC8vIFxccHtBc3NpZ25lZH0gaXMgZXF1aXZhbGVudCB0byBcXHB7XkNufVxyXG4gICAgICAgIC8vQXNzaWduZWQ6IFhSZWdFeHAoXCJbXFxcXHB7XkNufV1cIikuc291cmNlLnJlcGxhY2UoL1tbXFxdXXxcXFxcdS9nLCBcIlwiKSAvLyBOZWdhdGlvbiBpbnNpZGUgYSBjaGFyYWN0ZXIgY2xhc3MgdHJpZ2dlcnMgaW52ZXJzaW9uXHJcbiAgICAgICAgQXNzaWduZWQ6IFwiMDAwMC0wMzc3MDM3QS0wMzdFMDM4NC0wMzhBMDM4QzAzOEUtMDNBMTAzQTMtMDUyNzA1MzEtMDU1NjA1NTktMDU1RjA1NjEtMDU4NzA1ODkwNThBMDU4RjA1OTEtMDVDNzA1RDAtMDVFQTA1RjAtMDVGNDA2MDAtMDYwNDA2MDYtMDYxQjA2MUUtMDcwRDA3MEYtMDc0QTA3NEQtMDdCMTA3QzAtMDdGQTA4MDAtMDgyRDA4MzAtMDgzRTA4NDAtMDg1QjA4NUUwOEEwMDhBMi0wOEFDMDhFNC0wOEZFMDkwMC0wOTc3MDk3OS0wOTdGMDk4MS0wOTgzMDk4NS0wOThDMDk4RjA5OTAwOTkzLTA5QTgwOUFBLTA5QjAwOUIyMDlCNi0wOUI5MDlCQy0wOUM0MDlDNzA5QzgwOUNCLTA5Q0UwOUQ3MDlEQzA5REQwOURGLTA5RTMwOUU2LTA5RkIwQTAxLTBBMDMwQTA1LTBBMEEwQTBGMEExMDBBMTMtMEEyODBBMkEtMEEzMDBBMzIwQTMzMEEzNTBBMzYwQTM4MEEzOTBBM0MwQTNFLTBBNDIwQTQ3MEE0ODBBNEItMEE0RDBBNTEwQTU5LTBBNUMwQTVFMEE2Ni0wQTc1MEE4MS0wQTgzMEE4NS0wQThEMEE4Ri0wQTkxMEE5My0wQUE4MEFBQS0wQUIwMEFCMjBBQjMwQUI1LTBBQjkwQUJDLTBBQzUwQUM3LTBBQzkwQUNCLTBBQ0QwQUQwMEFFMC0wQUUzMEFFNi0wQUYxMEIwMS0wQjAzMEIwNS0wQjBDMEIwRjBCMTAwQjEzLTBCMjgwQjJBLTBCMzAwQjMyMEIzMzBCMzUtMEIzOTBCM0MtMEI0NDBCNDcwQjQ4MEI0Qi0wQjREMEI1NjBCNTcwQjVDMEI1RDBCNUYtMEI2MzBCNjYtMEI3NzBCODIwQjgzMEI4NS0wQjhBMEI4RS0wQjkwMEI5Mi0wQjk1MEI5OTBCOUEwQjlDMEI5RTBCOUYwQkEzMEJBNDBCQTgtMEJBQTBCQUUtMEJCOTBCQkUtMEJDMjBCQzYtMEJDODBCQ0EtMEJDRDBCRDAwQkQ3MEJFNi0wQkZBMEMwMS0wQzAzMEMwNS0wQzBDMEMwRS0wQzEwMEMxMi0wQzI4MEMyQS0wQzMzMEMzNS0wQzM5MEMzRC0wQzQ0MEM0Ni0wQzQ4MEM0QS0wQzREMEM1NTBDNTYwQzU4MEM1OTBDNjAtMEM2MzBDNjYtMEM2RjBDNzgtMEM3RjBDODIwQzgzMEM4NS0wQzhDMEM4RS0wQzkwMEM5Mi0wQ0E4MENBQS0wQ0IzMENCNS0wQ0I5MENCQy0wQ0M0MENDNi0wQ0M4MENDQS0wQ0NEMENENTBDRDYwQ0RFMENFMC0wQ0UzMENFNi0wQ0VGMENGMTBDRjIwRDAyMEQwMzBEMDUtMEQwQzBEMEUtMEQxMDBEMTItMEQzQTBEM0QtMEQ0NDBENDYtMEQ0ODBENEEtMEQ0RTBENTcwRDYwLTBENjMwRDY2LTBENzUwRDc5LTBEN0YwRDgyMEQ4MzBEODUtMEQ5NjBEOUEtMERCMTBEQjMtMERCQjBEQkQwREMwLTBEQzYwRENBMERDRi0wREQ0MERENjBERDgtMERERjBERjItMERGNDBFMDEtMEUzQTBFM0YtMEU1QjBFODEwRTgyMEU4NDBFODcwRTg4MEU4QTBFOEQwRTk0LTBFOTcwRTk5LTBFOUYwRUExLTBFQTMwRUE1MEVBNzBFQUEwRUFCMEVBRC0wRUI5MEVCQi0wRUJEMEVDMC0wRUM0MEVDNjBFQzgtMEVDRDBFRDAtMEVEOTBFREMtMEVERjBGMDAtMEY0NzBGNDktMEY2QzBGNzEtMEY5NzBGOTktMEZCQzBGQkUtMEZDQzBGQ0UtMEZEQTEwMDAtMTBDNTEwQzcxMENEMTBEMC0xMjQ4MTI0QS0xMjREMTI1MC0xMjU2MTI1ODEyNUEtMTI1RDEyNjAtMTI4ODEyOEEtMTI4RDEyOTAtMTJCMDEyQjItMTJCNTEyQjgtMTJCRTEyQzAxMkMyLTEyQzUxMkM4LTEyRDYxMkQ4LTEzMTAxMzEyLTEzMTUxMzE4LTEzNUExMzVELTEzN0MxMzgwLTEzOTkxM0EwLTEzRjQxNDAwLTE2OUMxNkEwLTE2RjAxNzAwLTE3MEMxNzBFLTE3MTQxNzIwLTE3MzYxNzQwLTE3NTMxNzYwLTE3NkMxNzZFLTE3NzAxNzcyMTc3MzE3ODAtMTdERDE3RTAtMTdFOTE3RjAtMTdGOTE4MDAtMTgwRTE4MTAtMTgxOTE4MjAtMTg3NzE4ODAtMThBQTE4QjAtMThGNTE5MDAtMTkxQzE5MjAtMTkyQjE5MzAtMTkzQjE5NDAxOTQ0LTE5NkQxOTcwLTE5NzQxOTgwLTE5QUIxOUIwLTE5QzkxOUQwLTE5REExOURFLTFBMUIxQTFFLTFBNUUxQTYwLTFBN0MxQTdGLTFBODkxQTkwLTFBOTkxQUEwLTFBQUQxQjAwLTFCNEIxQjUwLTFCN0MxQjgwLTFCRjMxQkZDLTFDMzcxQzNCLTFDNDkxQzRELTFDN0YxQ0MwLTFDQzcxQ0QwLTFDRjYxRDAwLTFERTYxREZDLTFGMTUxRjE4LTFGMUQxRjIwLTFGNDUxRjQ4LTFGNEQxRjUwLTFGNTcxRjU5MUY1QjFGNUQxRjVGLTFGN0QxRjgwLTFGQjQxRkI2LTFGQzQxRkM2LTFGRDMxRkQ2LTFGREIxRkRELTFGRUYxRkYyLTFGRjQxRkY2LTFGRkUyMDAwLTIwNjQyMDZBLTIwNzEyMDc0LTIwOEUyMDkwLTIwOUMyMEEwLTIwQjkyMEQwLTIwRjAyMTAwLTIxODkyMTkwLTIzRjMyNDAwLTI0MjYyNDQwLTI0NEEyNDYwLTI2RkYyNzAxLTJCNEMyQjUwLTJCNTkyQzAwLTJDMkUyQzMwLTJDNUUyQzYwLTJDRjMyQ0Y5LTJEMjUyRDI3MkQyRDJEMzAtMkQ2NzJENkYyRDcwMkQ3Ri0yRDk2MkRBMC0yREE2MkRBOC0yREFFMkRCMC0yREI2MkRCOC0yREJFMkRDMC0yREM2MkRDOC0yRENFMkREMC0yREQ2MkREOC0yRERFMkRFMC0yRTNCMkU4MC0yRTk5MkU5Qi0yRUYzMkYwMC0yRkQ1MkZGMC0yRkZCMzAwMC0zMDNGMzA0MS0zMDk2MzA5OS0zMEZGMzEwNS0zMTJEMzEzMS0zMThFMzE5MC0zMUJBMzFDMC0zMUUzMzFGMC0zMjFFMzIyMC0zMkZFMzMwMC00REI1NERDMC05RkNDQTAwMC1BNDhDQTQ5MC1BNEM2QTREMC1BNjJCQTY0MC1BNjk3QTY5Ri1BNkY3QTcwMC1BNzhFQTc5MC1BNzkzQTdBMC1BN0FBQTdGOC1BODJCQTgzMC1BODM5QTg0MC1BODc3QTg4MC1BOEM0QThDRS1BOEQ5QThFMC1BOEZCQTkwMC1BOTUzQTk1Ri1BOTdDQTk4MC1BOUNEQTlDRi1BOUQ5QTlERUE5REZBQTAwLUFBMzZBQTQwLUFBNERBQTUwLUFBNTlBQTVDLUFBN0JBQTgwLUFBQzJBQURCLUFBRjZBQjAxLUFCMDZBQjA5LUFCMEVBQjExLUFCMTZBQjIwLUFCMjZBQjI4LUFCMkVBQkMwLUFCRURBQkYwLUFCRjlBQzAwLUQ3QTNEN0IwLUQ3QzZEN0NCLUQ3RkJEODAwLUZBNkRGQTcwLUZBRDlGQjAwLUZCMDZGQjEzLUZCMTdGQjFELUZCMzZGQjM4LUZCM0NGQjNFRkI0MEZCNDFGQjQzRkI0NEZCNDYtRkJDMUZCRDMtRkQzRkZENTAtRkQ4RkZEOTItRkRDN0ZERjAtRkRGREZFMDAtRkUxOUZFMjAtRkUyNkZFMzAtRkU1MkZFNTQtRkU2NkZFNjgtRkU2QkZFNzAtRkU3NEZFNzYtRkVGQ0ZFRkZGRjAxLUZGQkVGRkMyLUZGQzdGRkNBLUZGQ0ZGRkQyLUZGRDdGRkRBLUZGRENGRkUwLUZGRTZGRkU4LUZGRUVGRkY5LUZGRkRcIlxyXG4gICAgfSk7XHJcblxyXG59KFhSZWdFeHApKTtcclxuXHJcblxuLyoqKioqIG1hdGNocmVjdXJzaXZlLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cC5tYXRjaFJlY3Vyc2l2ZSB2MC4yLjBcclxuICogKGMpIDIwMDktMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqL1xyXG5cclxuKGZ1bmN0aW9uIChYUmVnRXhwKSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgbWF0Y2ggZGV0YWlsIG9iamVjdCBjb21wb3NlZCBvZiB0aGUgcHJvdmlkZWQgdmFsdWVzLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIHJvdyh2YWx1ZSwgbmFtZSwgc3RhcnQsIGVuZCkge1xyXG4gICAgICAgIHJldHVybiB7dmFsdWU6dmFsdWUsIG5hbWU6bmFtZSwgc3RhcnQ6c3RhcnQsIGVuZDplbmR9O1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgbWF0Y2ggc3RyaW5ncyBiZXR3ZWVuIG91dGVybW9zdCBsZWZ0IGFuZCByaWdodCBkZWxpbWl0ZXJzLCBvciBhbiBhcnJheSBvZlxyXG4gKiBvYmplY3RzIHdpdGggZGV0YWlsZWQgbWF0Y2ggcGFydHMgYW5kIHBvc2l0aW9uIGRhdGEuIEFuIGVycm9yIGlzIHRocm93biBpZiBkZWxpbWl0ZXJzIGFyZVxyXG4gKiB1bmJhbGFuY2VkIHdpdGhpbiB0aGUgZGF0YS5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gbGVmdCBMZWZ0IGRlbGltaXRlciBhcyBhbiBYUmVnRXhwIHBhdHRlcm4uXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSByaWdodCBSaWdodCBkZWxpbWl0ZXIgYXMgYW4gWFJlZ0V4cCBwYXR0ZXJuLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2ZsYWdzXSBGbGFncyBmb3IgdGhlIGxlZnQgYW5kIHJpZ2h0IGRlbGltaXRlcnMuIFVzZSBhbnkgb2Y6IGBnaW1uc3h5YC5cclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBMZXRzIHlvdSBzcGVjaWZ5IGB2YWx1ZU5hbWVzYCBhbmQgYGVzY2FwZUNoYXJgIG9wdGlvbnMuXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gQXJyYXkgb2YgbWF0Y2hlcywgb3IgYW4gZW1wdHkgYXJyYXkuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEJhc2ljIHVzYWdlXHJcbiAqIHZhciBzdHIgPSAnKHQoKGUpKXMpdCgpKGluZyknO1xyXG4gKiBYUmVnRXhwLm1hdGNoUmVjdXJzaXZlKHN0ciwgJ1xcXFwoJywgJ1xcXFwpJywgJ2cnKTtcclxuICogLy8gLT4gWyd0KChlKSlzJywgJycsICdpbmcnXVxyXG4gKlxyXG4gKiAvLyBFeHRlbmRlZCBpbmZvcm1hdGlvbiBtb2RlIHdpdGggdmFsdWVOYW1lc1xyXG4gKiBzdHIgPSAnSGVyZSBpcyA8ZGl2PiA8ZGl2PmFuPC9kaXY+PC9kaXY+IGV4YW1wbGUnO1xyXG4gKiBYUmVnRXhwLm1hdGNoUmVjdXJzaXZlKHN0ciwgJzxkaXZcXFxccyo+JywgJzwvZGl2PicsICdnaScsIHtcclxuICogICB2YWx1ZU5hbWVzOiBbJ2JldHdlZW4nLCAnbGVmdCcsICdtYXRjaCcsICdyaWdodCddXHJcbiAqIH0pO1xyXG4gKiAvLyAtPiBbXHJcbiAqIC8vIHtuYW1lOiAnYmV0d2VlbicsIHZhbHVlOiAnSGVyZSBpcyAnLCAgICAgICBzdGFydDogMCwgIGVuZDogOH0sXHJcbiAqIC8vIHtuYW1lOiAnbGVmdCcsICAgIHZhbHVlOiAnPGRpdj4nLCAgICAgICAgICBzdGFydDogOCwgIGVuZDogMTN9LFxyXG4gKiAvLyB7bmFtZTogJ21hdGNoJywgICB2YWx1ZTogJyA8ZGl2PmFuPC9kaXY+Jywgc3RhcnQ6IDEzLCBlbmQ6IDI3fSxcclxuICogLy8ge25hbWU6ICdyaWdodCcsICAgdmFsdWU6ICc8L2Rpdj4nLCAgICAgICAgIHN0YXJ0OiAyNywgZW5kOiAzM30sXHJcbiAqIC8vIHtuYW1lOiAnYmV0d2VlbicsIHZhbHVlOiAnIGV4YW1wbGUnLCAgICAgICBzdGFydDogMzMsIGVuZDogNDF9XHJcbiAqIC8vIF1cclxuICpcclxuICogLy8gT21pdHRpbmcgdW5uZWVkZWQgcGFydHMgd2l0aCBudWxsIHZhbHVlTmFtZXMsIGFuZCB1c2luZyBlc2NhcGVDaGFyXHJcbiAqIHN0ciA9ICcuLi57MX1cXFxce3tmdW5jdGlvbih4LHkpe3JldHVybiB5K3g7fX0nO1xyXG4gKiBYUmVnRXhwLm1hdGNoUmVjdXJzaXZlKHN0ciwgJ3snLCAnfScsICdnJywge1xyXG4gKiAgIHZhbHVlTmFtZXM6IFsnbGl0ZXJhbCcsIG51bGwsICd2YWx1ZScsIG51bGxdLFxyXG4gKiAgIGVzY2FwZUNoYXI6ICdcXFxcJ1xyXG4gKiB9KTtcclxuICogLy8gLT4gW1xyXG4gKiAvLyB7bmFtZTogJ2xpdGVyYWwnLCB2YWx1ZTogJy4uLicsIHN0YXJ0OiAwLCBlbmQ6IDN9LFxyXG4gKiAvLyB7bmFtZTogJ3ZhbHVlJywgICB2YWx1ZTogJzEnLCAgIHN0YXJ0OiA0LCBlbmQ6IDV9LFxyXG4gKiAvLyB7bmFtZTogJ2xpdGVyYWwnLCB2YWx1ZTogJ1xcXFx7Jywgc3RhcnQ6IDYsIGVuZDogOH0sXHJcbiAqIC8vIHtuYW1lOiAndmFsdWUnLCAgIHZhbHVlOiAnZnVuY3Rpb24oeCx5KXtyZXR1cm4geSt4O30nLCBzdGFydDogOSwgZW5kOiAzNX1cclxuICogLy8gXVxyXG4gKlxyXG4gKiAvLyBTdGlja3kgbW9kZSB2aWEgZmxhZyB5XHJcbiAqIHN0ciA9ICc8MT48PDwyPj4+PDM+NDw1Pic7XHJcbiAqIFhSZWdFeHAubWF0Y2hSZWN1cnNpdmUoc3RyLCAnPCcsICc+JywgJ2d5Jyk7XHJcbiAqIC8vIC0+IFsnMScsICc8PDI+PicsICczJ11cclxuICovXHJcbiAgICBYUmVnRXhwLm1hdGNoUmVjdXJzaXZlID0gZnVuY3Rpb24gKHN0ciwgbGVmdCwgcmlnaHQsIGZsYWdzLCBvcHRpb25zKSB7XHJcbiAgICAgICAgZmxhZ3MgPSBmbGFncyB8fCBcIlwiO1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG4gICAgICAgIHZhciBnbG9iYWwgPSBmbGFncy5pbmRleE9mKFwiZ1wiKSA+IC0xLFxyXG4gICAgICAgICAgICBzdGlja3kgPSBmbGFncy5pbmRleE9mKFwieVwiKSA+IC0xLFxyXG4gICAgICAgICAgICBiYXNpY0ZsYWdzID0gZmxhZ3MucmVwbGFjZSgveS9nLCBcIlwiKSwgLy8gRmxhZyB5IGNvbnRyb2xsZWQgaW50ZXJuYWxseVxyXG4gICAgICAgICAgICBlc2NhcGVDaGFyID0gb3B0aW9ucy5lc2NhcGVDaGFyLFxyXG4gICAgICAgICAgICB2TiA9IG9wdGlvbnMudmFsdWVOYW1lcyxcclxuICAgICAgICAgICAgb3V0cHV0ID0gW10sXHJcbiAgICAgICAgICAgIG9wZW5Ub2tlbnMgPSAwLFxyXG4gICAgICAgICAgICBkZWxpbVN0YXJ0ID0gMCxcclxuICAgICAgICAgICAgZGVsaW1FbmQgPSAwLFxyXG4gICAgICAgICAgICBsYXN0T3V0ZXJFbmQgPSAwLFxyXG4gICAgICAgICAgICBvdXRlclN0YXJ0LFxyXG4gICAgICAgICAgICBpbm5lclN0YXJ0LFxyXG4gICAgICAgICAgICBsZWZ0TWF0Y2gsXHJcbiAgICAgICAgICAgIHJpZ2h0TWF0Y2gsXHJcbiAgICAgICAgICAgIGVzYztcclxuICAgICAgICBsZWZ0ID0gWFJlZ0V4cChsZWZ0LCBiYXNpY0ZsYWdzKTtcclxuICAgICAgICByaWdodCA9IFhSZWdFeHAocmlnaHQsIGJhc2ljRmxhZ3MpO1xyXG5cclxuICAgICAgICBpZiAoZXNjYXBlQ2hhcikge1xyXG4gICAgICAgICAgICBpZiAoZXNjYXBlQ2hhci5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJjYW4ndCB1c2UgbW9yZSB0aGFuIG9uZSBlc2NhcGUgY2hhcmFjdGVyXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVzY2FwZUNoYXIgPSBYUmVnRXhwLmVzY2FwZShlc2NhcGVDaGFyKTtcclxuICAgICAgICAgICAgLy8gVXNpbmcgWFJlZ0V4cC51bmlvbiBzYWZlbHkgcmV3cml0ZXMgYmFja3JlZmVyZW5jZXMgaW4gYGxlZnRgIGFuZCBgcmlnaHRgXHJcbiAgICAgICAgICAgIGVzYyA9IG5ldyBSZWdFeHAoXHJcbiAgICAgICAgICAgICAgICBcIig/OlwiICsgZXNjYXBlQ2hhciArIFwiW1xcXFxTXFxcXHNdfCg/Oig/IVwiICsgWFJlZ0V4cC51bmlvbihbbGVmdCwgcmlnaHRdKS5zb3VyY2UgKyBcIilbXlwiICsgZXNjYXBlQ2hhciArIFwiXSkrKStcIixcclxuICAgICAgICAgICAgICAgIGZsYWdzLnJlcGxhY2UoL1teaW1dKy9nLCBcIlwiKSAvLyBGbGFncyBneSBub3QgbmVlZGVkIGhlcmU7IGZsYWdzIG5zeCBoYW5kbGVkIGJ5IFhSZWdFeHBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XHJcbiAgICAgICAgICAgIC8vIElmIHVzaW5nIGFuIGVzY2FwZSBjaGFyYWN0ZXIsIGFkdmFuY2UgdG8gdGhlIGRlbGltaXRlcidzIG5leHQgc3RhcnRpbmcgcG9zaXRpb24sXHJcbiAgICAgICAgICAgIC8vIHNraXBwaW5nIGFueSBlc2NhcGVkIGNoYXJhY3RlcnMgaW4gYmV0d2VlblxyXG4gICAgICAgICAgICBpZiAoZXNjYXBlQ2hhcikge1xyXG4gICAgICAgICAgICAgICAgZGVsaW1FbmQgKz0gKFhSZWdFeHAuZXhlYyhzdHIsIGVzYywgZGVsaW1FbmQsIFwic3RpY2t5XCIpIHx8IFtcIlwiXSlbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxlZnRNYXRjaCA9IFhSZWdFeHAuZXhlYyhzdHIsIGxlZnQsIGRlbGltRW5kKTtcclxuICAgICAgICAgICAgcmlnaHRNYXRjaCA9IFhSZWdFeHAuZXhlYyhzdHIsIHJpZ2h0LCBkZWxpbUVuZCk7XHJcbiAgICAgICAgICAgIC8vIEtlZXAgdGhlIGxlZnRtb3N0IG1hdGNoIG9ubHlcclxuICAgICAgICAgICAgaWYgKGxlZnRNYXRjaCAmJiByaWdodE1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobGVmdE1hdGNoLmluZGV4IDw9IHJpZ2h0TWF0Y2guaW5kZXgpIHtcclxuICAgICAgICAgICAgICAgICAgICByaWdodE1hdGNoID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGVmdE1hdGNoID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvKiBQYXRocyAoTE06bGVmdE1hdGNoLCBSTTpyaWdodE1hdGNoLCBPVDpvcGVuVG9rZW5zKTpcclxuICAgICAgICAgICAgTE0gfCBSTSB8IE9UIHwgUmVzdWx0XHJcbiAgICAgICAgICAgIDEgIHwgMCAgfCAxICB8IGxvb3BcclxuICAgICAgICAgICAgMSAgfCAwICB8IDAgIHwgbG9vcFxyXG4gICAgICAgICAgICAwICB8IDEgIHwgMSAgfCBsb29wXHJcbiAgICAgICAgICAgIDAgIHwgMSAgfCAwICB8IHRocm93XHJcbiAgICAgICAgICAgIDAgIHwgMCAgfCAxICB8IHRocm93XHJcbiAgICAgICAgICAgIDAgIHwgMCAgfCAwICB8IGJyZWFrXHJcbiAgICAgICAgICAgICogRG9lc24ndCBpbmNsdWRlIHRoZSBzdGlja3kgbW9kZSBzcGVjaWFsIGNhc2VcclxuICAgICAgICAgICAgKiBMb29wIGVuZHMgYWZ0ZXIgdGhlIGZpcnN0IGNvbXBsZXRlZCBtYXRjaCBpZiBgIWdsb2JhbGAgKi9cclxuICAgICAgICAgICAgaWYgKGxlZnRNYXRjaCB8fCByaWdodE1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxpbVN0YXJ0ID0gKGxlZnRNYXRjaCB8fCByaWdodE1hdGNoKS5pbmRleDtcclxuICAgICAgICAgICAgICAgIGRlbGltRW5kID0gZGVsaW1TdGFydCArIChsZWZ0TWF0Y2ggfHwgcmlnaHRNYXRjaClbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFvcGVuVG9rZW5zKSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoc3RpY2t5ICYmICFvcGVuVG9rZW5zICYmIGRlbGltU3RhcnQgPiBsYXN0T3V0ZXJFbmQpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChsZWZ0TWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgIGlmICghb3BlblRva2Vucykge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dGVyU3RhcnQgPSBkZWxpbVN0YXJ0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlubmVyU3RhcnQgPSBkZWxpbUVuZDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICsrb3BlblRva2VucztcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChyaWdodE1hdGNoICYmIG9wZW5Ub2tlbnMpIHtcclxuICAgICAgICAgICAgICAgIGlmICghLS1vcGVuVG9rZW5zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZOKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2TlswXSAmJiBvdXRlclN0YXJ0ID4gbGFzdE91dGVyRW5kKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChyb3codk5bMF0sIHN0ci5zbGljZShsYXN0T3V0ZXJFbmQsIG91dGVyU3RhcnQpLCBsYXN0T3V0ZXJFbmQsIG91dGVyU3RhcnQpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodk5bMV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKHJvdyh2TlsxXSwgc3RyLnNsaWNlKG91dGVyU3RhcnQsIGlubmVyU3RhcnQpLCBvdXRlclN0YXJ0LCBpbm5lclN0YXJ0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZOWzJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChyb3codk5bMl0sIHN0ci5zbGljZShpbm5lclN0YXJ0LCBkZWxpbVN0YXJ0KSwgaW5uZXJTdGFydCwgZGVsaW1TdGFydCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2TlszXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gocm93KHZOWzNdLCBzdHIuc2xpY2UoZGVsaW1TdGFydCwgZGVsaW1FbmQpLCBkZWxpbVN0YXJ0LCBkZWxpbUVuZCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGlubmVyU3RhcnQsIGRlbGltU3RhcnQpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdE91dGVyRW5kID0gZGVsaW1FbmQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFnbG9iYWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwic3RyaW5nIGNvbnRhaW5zIHVuYmFsYW5jZWQgZGVsaW1pdGVyc1wiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBJZiB0aGUgZGVsaW1pdGVyIG1hdGNoZWQgYW4gZW1wdHkgc3RyaW5nLCBhdm9pZCBhbiBpbmZpbml0ZSBsb29wXHJcbiAgICAgICAgICAgIGlmIChkZWxpbVN0YXJ0ID09PSBkZWxpbUVuZCkge1xyXG4gICAgICAgICAgICAgICAgKytkZWxpbUVuZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGdsb2JhbCAmJiAhc3RpY2t5ICYmIHZOICYmIHZOWzBdICYmIHN0ci5sZW5ndGggPiBsYXN0T3V0ZXJFbmQpIHtcclxuICAgICAgICAgICAgb3V0cHV0LnB1c2gocm93KHZOWzBdLCBzdHIuc2xpY2UobGFzdE91dGVyRW5kKSwgbGFzdE91dGVyRW5kLCBzdHIubGVuZ3RoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gb3V0cHV0O1xyXG4gICAgfTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogYnVpbGQuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwLmJ1aWxkIHYwLjEuMFxyXG4gKiAoYykgMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqIEluc3BpcmVkIGJ5IFJlZ0V4cC5jcmVhdGUgYnkgTGVhIFZlcm91IDxodHRwOi8vbGVhLnZlcm91Lm1lLz5cclxuICovXHJcblxyXG4oZnVuY3Rpb24gKFhSZWdFeHApIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIHZhciBzdWJwYXJ0cyA9IC8oXFwoKSg/IVxcPyl8XFxcXChbMS05XVxcZCopfFxcXFxbXFxzXFxTXXxcXFsoPzpbXlxcXFxcXF1dfFxcXFxbXFxzXFxTXSkqXS9nLFxyXG4gICAgICAgIHBhcnRzID0gWFJlZ0V4cC51bmlvbihbL1xcKHt7KFtcXHckXSspfX1cXCl8e3soW1xcdyRdKyl9fS8sIHN1YnBhcnRzXSwgXCJnXCIpO1xyXG5cclxuLyoqXHJcbiAqIFN0cmlwcyBhIGxlYWRpbmcgYF5gIGFuZCB0cmFpbGluZyB1bmVzY2FwZWQgYCRgLCBpZiBib3RoIGFyZSBwcmVzZW50LlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0dGVybiBQYXR0ZXJuIHRvIHByb2Nlc3MuXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IFBhdHRlcm4gd2l0aCBlZGdlIGFuY2hvcnMgcmVtb3ZlZC5cclxuICovXHJcbiAgICBmdW5jdGlvbiBkZWFuY2hvcihwYXR0ZXJuKSB7XHJcbiAgICAgICAgdmFyIHN0YXJ0QW5jaG9yID0gL14oPzpcXChcXD86XFwpKT9cXF4vLCAvLyBMZWFkaW5nIGBeYCBvciBgKD86KV5gIChoYW5kbGVzIC94IGNydWZ0KVxyXG4gICAgICAgICAgICBlbmRBbmNob3IgPSAvXFwkKD86XFwoXFw/OlxcKSk/JC87IC8vIFRyYWlsaW5nIGAkYCBvciBgJCg/OilgIChoYW5kbGVzIC94IGNydWZ0KVxyXG4gICAgICAgIGlmIChlbmRBbmNob3IudGVzdChwYXR0ZXJuLnJlcGxhY2UoL1xcXFxbXFxzXFxTXS9nLCBcIlwiKSkpIHsgLy8gRW5zdXJlIHRyYWlsaW5nIGAkYCBpc24ndCBlc2NhcGVkXHJcbiAgICAgICAgICAgIHJldHVybiBwYXR0ZXJuLnJlcGxhY2Uoc3RhcnRBbmNob3IsIFwiXCIpLnJlcGxhY2UoZW5kQW5jaG9yLCBcIlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHBhdHRlcm47XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhlIHByb3ZpZGVkIHZhbHVlIHRvIGFuIFhSZWdFeHAuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFJlZ0V4cH0gdmFsdWUgVmFsdWUgdG8gY29udmVydC5cclxuICogQHJldHVybnMge1JlZ0V4cH0gWFJlZ0V4cCBvYmplY3Qgd2l0aCBYUmVnRXhwIHN5bnRheCBhcHBsaWVkLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGFzWFJlZ0V4cCh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiBYUmVnRXhwLmlzUmVnRXhwKHZhbHVlKSA/XHJcbiAgICAgICAgICAgICAgICAodmFsdWUueHJlZ2V4cCAmJiAhdmFsdWUueHJlZ2V4cC5pc05hdGl2ZSA/IHZhbHVlIDogWFJlZ0V4cCh2YWx1ZS5zb3VyY2UpKSA6XHJcbiAgICAgICAgICAgICAgICBYUmVnRXhwKHZhbHVlKTtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBCdWlsZHMgcmVnZXhlcyB1c2luZyBuYW1lZCBzdWJwYXR0ZXJucywgZm9yIHJlYWRhYmlsaXR5IGFuZCBwYXR0ZXJuIHJldXNlLiBCYWNrcmVmZXJlbmNlcyBpbiB0aGVcclxuICogb3V0ZXIgcGF0dGVybiBhbmQgcHJvdmlkZWQgc3VicGF0dGVybnMgYXJlIGF1dG9tYXRpY2FsbHkgcmVudW1iZXJlZCB0byB3b3JrIGNvcnJlY3RseS4gTmF0aXZlXHJcbiAqIGZsYWdzIHVzZWQgYnkgcHJvdmlkZWQgc3VicGF0dGVybnMgYXJlIGlnbm9yZWQgaW4gZmF2b3Igb2YgdGhlIGBmbGFnc2AgYXJndW1lbnQuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXR0ZXJuIFhSZWdFeHAgcGF0dGVybiB1c2luZyBge3tuYW1lfX1gIGZvciBlbWJlZGRlZCBzdWJwYXR0ZXJucy4gQWxsb3dzXHJcbiAqICAgYCh7e25hbWV9fSlgIGFzIHNob3J0aGFuZCBmb3IgYCg/PG5hbWU+e3tuYW1lfX0pYC4gUGF0dGVybnMgY2Fubm90IGJlIGVtYmVkZGVkIHdpdGhpblxyXG4gKiAgIGNoYXJhY3RlciBjbGFzc2VzLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gc3VicyBMb29rdXAgb2JqZWN0IGZvciBuYW1lZCBzdWJwYXR0ZXJucy4gVmFsdWVzIGNhbiBiZSBzdHJpbmdzIG9yIHJlZ2V4ZXMuIEFcclxuICogICBsZWFkaW5nIGBeYCBhbmQgdHJhaWxpbmcgdW5lc2NhcGVkIGAkYCBhcmUgc3RyaXBwZWQgZnJvbSBzdWJwYXR0ZXJucywgaWYgYm90aCBhcmUgcHJlc2VudC5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtmbGFnc10gQW55IGNvbWJpbmF0aW9uIG9mIFhSZWdFeHAgZmxhZ3MuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IFJlZ2V4IHdpdGggaW50ZXJwb2xhdGVkIHN1YnBhdHRlcm5zLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiB2YXIgdGltZSA9IFhSZWdFeHAuYnVpbGQoJyg/eCleIHt7aG91cnN9fSAoe3ttaW51dGVzfX0pICQnLCB7XHJcbiAqICAgaG91cnM6IFhSZWdFeHAuYnVpbGQoJ3t7aDEyfX0gOiB8IHt7aDI0fX0nLCB7XHJcbiAqICAgICBoMTI6IC8xWzAtMl18MD9bMS05XS8sXHJcbiAqICAgICBoMjQ6IC8yWzAtM118WzAxXVswLTldL1xyXG4gKiAgIH0sICd4JyksXHJcbiAqICAgbWludXRlczogL15bMC01XVswLTldJC9cclxuICogfSk7XHJcbiAqIHRpbWUudGVzdCgnMTA6NTknKTsgLy8gLT4gdHJ1ZVxyXG4gKiBYUmVnRXhwLmV4ZWMoJzEwOjU5JywgdGltZSkubWludXRlczsgLy8gLT4gJzU5J1xyXG4gKi9cclxuICAgIFhSZWdFeHAuYnVpbGQgPSBmdW5jdGlvbiAocGF0dGVybiwgc3VicywgZmxhZ3MpIHtcclxuICAgICAgICB2YXIgaW5saW5lRmxhZ3MgPSAvXlxcKFxcPyhbXFx3JF0rKVxcKS8uZXhlYyhwYXR0ZXJuKSxcclxuICAgICAgICAgICAgZGF0YSA9IHt9LFxyXG4gICAgICAgICAgICBudW1DYXBzID0gMCwgLy8gQ2FwcyBpcyBzaG9ydCBmb3IgY2FwdHVyZXNcclxuICAgICAgICAgICAgbnVtUHJpb3JDYXBzLFxyXG4gICAgICAgICAgICBudW1PdXRlckNhcHMgPSAwLFxyXG4gICAgICAgICAgICBvdXRlckNhcHNNYXAgPSBbMF0sXHJcbiAgICAgICAgICAgIG91dGVyQ2FwTmFtZXMsXHJcbiAgICAgICAgICAgIHN1YixcclxuICAgICAgICAgICAgcDtcclxuXHJcbiAgICAgICAgLy8gQWRkIGZsYWdzIHdpdGhpbiBhIGxlYWRpbmcgbW9kZSBtb2RpZmllciB0byB0aGUgb3ZlcmFsbCBwYXR0ZXJuJ3MgZmxhZ3NcclxuICAgICAgICBpZiAoaW5saW5lRmxhZ3MpIHtcclxuICAgICAgICAgICAgZmxhZ3MgPSBmbGFncyB8fCBcIlwiO1xyXG4gICAgICAgICAgICBpbmxpbmVGbGFnc1sxXS5yZXBsYWNlKC8uL2csIGZ1bmN0aW9uIChmbGFnKSB7XHJcbiAgICAgICAgICAgICAgICBmbGFncyArPSAoZmxhZ3MuaW5kZXhPZihmbGFnKSA+IC0xID8gXCJcIiA6IGZsYWcpOyAvLyBEb24ndCBhZGQgZHVwbGljYXRlc1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAocCBpbiBzdWJzKSB7XHJcbiAgICAgICAgICAgIGlmIChzdWJzLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBQYXNzaW5nIHRvIFhSZWdFeHAgZW5hYmxlcyBlbnRlbmRlZCBzeW50YXggZm9yIHN1YnBhdHRlcm5zIHByb3ZpZGVkIGFzIHN0cmluZ3NcclxuICAgICAgICAgICAgICAgIC8vIGFuZCBlbnN1cmVzIGluZGVwZW5kZW50IHZhbGlkaXR5LCBsZXN0IGFuIHVuZXNjYXBlZCBgKGAsIGApYCwgYFtgLCBvciB0cmFpbGluZ1xyXG4gICAgICAgICAgICAgICAgLy8gYFxcYCBicmVha3MgdGhlIGAoPzopYCB3cmFwcGVyLiBGb3Igc3VicGF0dGVybnMgcHJvdmlkZWQgYXMgcmVnZXhlcywgaXQgZGllcyBvblxyXG4gICAgICAgICAgICAgICAgLy8gb2N0YWxzIGFuZCBhZGRzIHRoZSBgeHJlZ2V4cGAgcHJvcGVydHksIGZvciBzaW1wbGljaXR5XHJcbiAgICAgICAgICAgICAgICBzdWIgPSBhc1hSZWdFeHAoc3Vic1twXSk7XHJcbiAgICAgICAgICAgICAgICAvLyBEZWFuY2hvcmluZyBhbGxvd3MgZW1iZWRkaW5nIGluZGVwZW5kZW50bHkgdXNlZnVsIGFuY2hvcmVkIHJlZ2V4ZXMuIElmIHlvdVxyXG4gICAgICAgICAgICAgICAgLy8gcmVhbGx5IG5lZWQgdG8ga2VlcCB5b3VyIGFuY2hvcnMsIGRvdWJsZSB0aGVtIChpLmUuLCBgXl4uLi4kJGApXHJcbiAgICAgICAgICAgICAgICBkYXRhW3BdID0ge3BhdHRlcm46IGRlYW5jaG9yKHN1Yi5zb3VyY2UpLCBuYW1lczogc3ViLnhyZWdleHAuY2FwdHVyZU5hbWVzIHx8IFtdfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gUGFzc2luZyB0byBYUmVnRXhwIGRpZXMgb24gb2N0YWxzIGFuZCBlbnN1cmVzIHRoZSBvdXRlciBwYXR0ZXJuIGlzIGluZGVwZW5kZW50bHkgdmFsaWQ7XHJcbiAgICAgICAgLy8gaGVscHMga2VlcCB0aGlzIHNpbXBsZS4gTmFtZWQgY2FwdHVyZXMgd2lsbCBiZSBwdXQgYmFja1xyXG4gICAgICAgIHBhdHRlcm4gPSBhc1hSZWdFeHAocGF0dGVybik7XHJcbiAgICAgICAgb3V0ZXJDYXBOYW1lcyA9IHBhdHRlcm4ueHJlZ2V4cC5jYXB0dXJlTmFtZXMgfHwgW107XHJcbiAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4uc291cmNlLnJlcGxhY2UocGFydHMsIGZ1bmN0aW9uICgkMCwgJDEsICQyLCAkMywgJDQpIHtcclxuICAgICAgICAgICAgdmFyIHN1Yk5hbWUgPSAkMSB8fCAkMiwgY2FwTmFtZSwgaW50cm87XHJcbiAgICAgICAgICAgIGlmIChzdWJOYW1lKSB7IC8vIE5hbWVkIHN1YnBhdHRlcm5cclxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5oYXNPd25Qcm9wZXJ0eShzdWJOYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInVuZGVmaW5lZCBwcm9wZXJ0eSBcIiArICQwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICgkMSkgeyAvLyBOYW1lZCBzdWJwYXR0ZXJuIHdhcyB3cmFwcGVkIGluIGEgY2FwdHVyaW5nIGdyb3VwXHJcbiAgICAgICAgICAgICAgICAgICAgY2FwTmFtZSA9IG91dGVyQ2FwTmFtZXNbbnVtT3V0ZXJDYXBzXTtcclxuICAgICAgICAgICAgICAgICAgICBvdXRlckNhcHNNYXBbKytudW1PdXRlckNhcHNdID0gKytudW1DYXBzO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3MgYSBuYW1lZCBncm91cCwgcHJlc2VydmUgdGhlIG5hbWUuIE90aGVyd2lzZSwgdXNlIHRoZSBzdWJwYXR0ZXJuIG5hbWVcclxuICAgICAgICAgICAgICAgICAgICAvLyBhcyB0aGUgY2FwdHVyZSBuYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgaW50cm8gPSBcIig/PFwiICsgKGNhcE5hbWUgfHwgc3ViTmFtZSkgKyBcIj5cIjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW50cm8gPSBcIig/OlwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbnVtUHJpb3JDYXBzID0gbnVtQ2FwcztcclxuICAgICAgICAgICAgICAgIHJldHVybiBpbnRybyArIGRhdGFbc3ViTmFtZV0ucGF0dGVybi5yZXBsYWNlKHN1YnBhcnRzLCBmdW5jdGlvbiAobWF0Y2gsIHBhcmVuLCBiYWNrcmVmKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVuKSB7IC8vIENhcHR1cmluZyBncm91cFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXBOYW1lID0gZGF0YVtzdWJOYW1lXS5uYW1lc1tudW1DYXBzIC0gbnVtUHJpb3JDYXBzXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgKytudW1DYXBzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FwTmFtZSkgeyAvLyBJZiB0aGUgY3VycmVudCBjYXB0dXJlIGhhcyBhIG5hbWUsIHByZXNlcnZlIHRoZSBuYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIoPzxcIiArIGNhcE5hbWUgKyBcIj5cIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYmFja3JlZikgeyAvLyBCYWNrcmVmZXJlbmNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIlxcXFxcIiArICgrYmFja3JlZiArIG51bVByaW9yQ2Fwcyk7IC8vIFJld3JpdGUgdGhlIGJhY2tyZWZlcmVuY2VcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgICAgICAgICAgICAgfSkgKyBcIilcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoJDMpIHsgLy8gQ2FwdHVyaW5nIGdyb3VwXHJcbiAgICAgICAgICAgICAgICBjYXBOYW1lID0gb3V0ZXJDYXBOYW1lc1tudW1PdXRlckNhcHNdO1xyXG4gICAgICAgICAgICAgICAgb3V0ZXJDYXBzTWFwWysrbnVtT3V0ZXJDYXBzXSA9ICsrbnVtQ2FwcztcclxuICAgICAgICAgICAgICAgIGlmIChjYXBOYW1lKSB7IC8vIElmIHRoZSBjdXJyZW50IGNhcHR1cmUgaGFzIGEgbmFtZSwgcHJlc2VydmUgdGhlIG5hbWVcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIoPzxcIiArIGNhcE5hbWUgKyBcIj5cIjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmICgkNCkgeyAvLyBCYWNrcmVmZXJlbmNlXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcXFxcXCIgKyBvdXRlckNhcHNNYXBbKyQ0XTsgLy8gUmV3cml0ZSB0aGUgYmFja3JlZmVyZW5jZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiAkMDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFhSZWdFeHAocGF0dGVybiwgZmxhZ3MpO1xyXG4gICAgfTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogcHJvdG90eXBlcy5qcyAqKioqKi9cblxuLyohXHJcbiAqIFhSZWdFeHAgUHJvdG90eXBlIE1ldGhvZHMgdjEuMC4wXHJcbiAqIChjKSAyMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICovXHJcblxyXG4vKipcclxuICogQWRkcyBhIGNvbGxlY3Rpb24gb2YgbWV0aG9kcyB0byBgWFJlZ0V4cC5wcm90b3R5cGVgLiBSZWdFeHAgb2JqZWN0cyBjb3BpZWQgYnkgWFJlZ0V4cCBhcmUgYWxzb1xyXG4gKiBhdWdtZW50ZWQgd2l0aCBhbnkgYFhSZWdFeHAucHJvdG90eXBlYCBtZXRob2RzLiBIZW5jZSwgdGhlIGZvbGxvd2luZyB3b3JrIGVxdWl2YWxlbnRseTpcclxuICpcclxuICogWFJlZ0V4cCgnW2Etel0nLCAnaWcnKS54ZXhlYygnYWJjJyk7XHJcbiAqIFhSZWdFeHAoL1thLXpdL2lnKS54ZXhlYygnYWJjJyk7XHJcbiAqIFhSZWdFeHAuZ2xvYmFsaXplKC9bYS16XS9pKS54ZXhlYygnYWJjJyk7XHJcbiAqL1xyXG4oZnVuY3Rpb24gKFhSZWdFeHApIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIENvcHkgcHJvcGVydGllcyBvZiBgYmAgdG8gYGFgLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gYSBPYmplY3QgdGhhdCB3aWxsIHJlY2VpdmUgbmV3IHByb3BlcnRpZXMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBiIE9iamVjdCB3aG9zZSBwcm9wZXJ0aWVzIHdpbGwgYmUgY29waWVkLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGV4dGVuZChhLCBiKSB7XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBiKSB7XHJcbiAgICAgICAgICAgIGlmIChiLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgICAgICBhW3BdID0gYltwXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICAvL3JldHVybiBhO1xyXG4gICAgfVxyXG5cclxuICAgIGV4dGVuZChYUmVnRXhwLnByb3RvdHlwZSwge1xyXG5cclxuLyoqXHJcbiAqIEltcGxpY2l0bHkgY2FsbHMgdGhlIHJlZ2V4J3MgYHRlc3RgIG1ldGhvZCB3aXRoIHRoZSBmaXJzdCB2YWx1ZSBpbiB0aGUgcHJvdmlkZWQgYXJndW1lbnRzIGFycmF5LlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cC5wcm90b3R5cGVcclxuICogQHBhcmFtIHsqfSBjb250ZXh0IElnbm9yZWQuIEFjY2VwdGVkIG9ubHkgZm9yIGNvbmdydWl0eSB3aXRoIGBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHlgLlxyXG4gKiBAcGFyYW0ge0FycmF5fSBhcmdzIEFycmF5IHdpdGggdGhlIHN0cmluZyB0byBzZWFyY2ggYXMgaXRzIGZpcnN0IHZhbHVlLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciB0aGUgcmVnZXggbWF0Y2hlZCB0aGUgcHJvdmlkZWQgdmFsdWUuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAoJ1thLXpdJykuYXBwbHkobnVsbCwgWydhYmMnXSk7IC8vIC0+IHRydWVcclxuICovXHJcbiAgICAgICAgYXBwbHk6IGZ1bmN0aW9uIChjb250ZXh0LCBhcmdzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRlc3QoYXJnc1swXSk7XHJcbiAgICAgICAgfSxcclxuXHJcbi8qKlxyXG4gKiBJbXBsaWNpdGx5IGNhbGxzIHRoZSByZWdleCdzIGB0ZXN0YCBtZXRob2Qgd2l0aCB0aGUgcHJvdmlkZWQgc3RyaW5nLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cC5wcm90b3R5cGVcclxuICogQHBhcmFtIHsqfSBjb250ZXh0IElnbm9yZWQuIEFjY2VwdGVkIG9ubHkgZm9yIGNvbmdydWl0eSB3aXRoIGBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbGAuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHJlZ2V4IG1hdGNoZWQgdGhlIHByb3ZpZGVkIHZhbHVlLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwKCdbYS16XScpLmNhbGwobnVsbCwgJ2FiYycpOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgICAgIGNhbGw6IGZ1bmN0aW9uIChjb250ZXh0LCBzdHIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVzdChzdHIpO1xyXG4gICAgICAgIH0sXHJcblxyXG4vKipcclxuICogSW1wbGljaXRseSBjYWxscyB7QGxpbmsgI1hSZWdFeHAuZm9yRWFjaH0uXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwKCdcXFxcZCcpLmZvckVhY2goJzFhMjM0NScsIGZ1bmN0aW9uIChtYXRjaCwgaSkge1xyXG4gKiAgIGlmIChpICUgMikgdGhpcy5wdXNoKCttYXRjaFswXSk7XHJcbiAqIH0sIFtdKTtcclxuICogLy8gLT4gWzIsIDRdXHJcbiAqL1xyXG4gICAgICAgIGZvckVhY2g6IGZ1bmN0aW9uIChzdHIsIGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBYUmVnRXhwLmZvckVhY2goc3RyLCB0aGlzLCBjYWxsYmFjaywgY29udGV4dCk7XHJcbiAgICAgICAgfSxcclxuXHJcbi8qKlxyXG4gKiBJbXBsaWNpdGx5IGNhbGxzIHtAbGluayAjWFJlZ0V4cC5nbG9iYWxpemV9LlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cC5wcm90b3R5cGVcclxuICogQGV4YW1wbGVcclxuICpcclxuICogdmFyIGdsb2JhbENvcHkgPSBYUmVnRXhwKCdyZWdleCcpLmdsb2JhbGl6ZSgpO1xyXG4gKiBnbG9iYWxDb3B5Lmdsb2JhbDsgLy8gLT4gdHJ1ZVxyXG4gKi9cclxuICAgICAgICBnbG9iYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFhSZWdFeHAuZ2xvYmFsaXplKHRoaXMpO1xyXG4gICAgICAgIH0sXHJcblxyXG4vKipcclxuICogSW1wbGljaXRseSBjYWxscyB7QGxpbmsgI1hSZWdFeHAuZXhlY30uXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiB2YXIgbWF0Y2ggPSBYUmVnRXhwKCdVXFxcXCsoPzxoZXg+WzAtOUEtRl17NH0pJykueGV4ZWMoJ1UrMjYyMCcpO1xyXG4gKiBtYXRjaC5oZXg7IC8vIC0+ICcyNjIwJ1xyXG4gKi9cclxuICAgICAgICB4ZXhlYzogZnVuY3Rpb24gKHN0ciwgcG9zLCBzdGlja3kpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFhSZWdFeHAuZXhlYyhzdHIsIHRoaXMsIHBvcywgc3RpY2t5KTtcclxuICAgICAgICB9LFxyXG5cclxuLyoqXHJcbiAqIEltcGxpY2l0bHkgY2FsbHMge0BsaW5rICNYUmVnRXhwLnRlc3R9LlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cC5wcm90b3R5cGVcclxuICogQGV4YW1wbGVcclxuICpcclxuICogWFJlZ0V4cCgnYycpLnh0ZXN0KCdhYmMnKTsgLy8gLT4gdHJ1ZVxyXG4gKi9cclxuICAgICAgICB4dGVzdDogZnVuY3Rpb24gKHN0ciwgcG9zLCBzdGlja3kpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFhSZWdFeHAudGVzdChzdHIsIHRoaXMsIHBvcywgc3RpY2t5KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfSk7XHJcblxyXG59KFhSZWdFeHApKTtcclxuXHJcbiIsIi8qKlxuICogRGVzY3JpcHRvcnMgZGVhbCB3aXRoIHRoZSBkZXNjcmlwdGlvbiBvZiBIVFRQIHJlcXVlc3RzIGFuZCBhcmUgdXNlZCBieSBTaWVzdGEgdG8gZGV0ZXJtaW5lIHdoYXQgdG8gZG9cbiAqIHdpdGggSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGJvZGllcy5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgbG9nID0gX2kubG9nLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGFzc2VydCA9IF9pLm1pc2MuYXNzZXJ0LFxuICAgIGRlZmluZVN1YlByb3BlcnR5ID0gX2kubWlzYy5kZWZpbmVTdWJQcm9wZXJ0eSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSBfaS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgZXh0ZW5kID0gX2kuZXh0ZW5kLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG4vLyBUaGUgWFJlZ0V4cCBvYmplY3QgaGFzIHRoZXNlIHByb3BlcnRpZXMgdGhhdCB3ZSB3YW50IHRvIGlnbm9yZSB3aGVuIG1hdGNoaW5nLlxudmFyIGlnbm9yZSA9IFsnaW5kZXgnLCAnaW5wdXQnXTtcbnZhciBYUmVnRXhwID0gcmVxdWlyZSgneHJlZ2V4cCcpLlhSZWdFeHA7XG5cbnZhciBodHRwTWV0aG9kcyA9IFsnUE9TVCcsICdQQVRDSCcsICdQVVQnLCAnSEVBRCcsICdHRVQnLCAnREVMRVRFJywgJ09QVElPTlMnLCAnVFJBQ0UnLCAnQ09OTkVDVCddO1xuXG5mdW5jdGlvbiByZXNvbHZlTWV0aG9kKG1ldGhvZHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB3aWxkY2FyZHMgaW50byBtZXRob2RzIGFuZCBlbnN1cmUgaXMgYW4gYXJyYXkgb2YgdXBwZXJjYXNlIG1ldGhvZHMuXG4gICAgaWYgKG1ldGhvZHMpIHtcbiAgICAgICAgaWYgKG1ldGhvZHMgPT0gJyonIHx8IG1ldGhvZHMuaW5kZXhPZignKicpID4gLTEpIHtcbiAgICAgICAgICAgIG1ldGhvZHMgPSBodHRwTWV0aG9kcztcbiAgICAgICAgfSBlbHNlIGlmICghdXRpbC5pc0FycmF5KG1ldGhvZHMpKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gW21ldGhvZHNdO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWV0aG9kcyA9IFsnR0VUJ107XG4gICAgfVxuICAgIHJldHVybiBfLm1hcChtZXRob2RzLCBmdW5jdGlvbih4KSB7XG4gICAgICAgIHJldHVybiB4LnRvVXBwZXJDYXNlKClcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBBIGRlc2NyaXB0b3IgJ2Rlc2NyaWJlcycgcG9zc2libGUgSFRUUCByZXF1ZXN0cyBhZ2FpbnN0IGFuIEFQSSwgYW5kIGlzIHVzZWQgdG8gZGVjaWRlIHdoZXRoZXIgb3Igbm90IHRvXG4gKiBpbnRlcmNlcHQgYSBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYW5kIHBlcmZvcm0gYSBtYXBwaW5nLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdPcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIC8vIENvbnZlcnQgcGF0aCBzdHJpbmcgaW50byBYUmVnRXhwIGlmIG5vdCBhbHJlYWR5LlxuICAgIGlmICh0aGlzLl9vcHRzLnBhdGgpIHtcbiAgICAgICAgaWYgKCEodGhpcy5fb3B0cy5wYXRoIGluc3RhbmNlb2YgWFJlZ0V4cCkpIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFhSZWdFeHAodGhpcy5fb3B0cy5wYXRoKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9ICcnO1xuICAgIH1cblxuICAgIHRoaXMuX29wdHMubWV0aG9kID0gcmVzb2x2ZU1ldGhvZCh0aGlzLl9vcHRzLm1ldGhvZCk7XG5cbiAgICAvLyBNYXBwaW5ncyBjYW4gYmUgcGFzc2VkIGFzIHRoZSBhY3R1YWwgbWFwcGluZyBvYmplY3Qgb3IgYXMgYSBzdHJpbmcgKHdpdGggQVBJIHNwZWNpZmllZCB0b28pXG4gICAgaWYgKHRoaXMuX29wdHMubWFwcGluZykge1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMubWFwcGluZykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vcHRzLmNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVt0aGlzLl9vcHRzLmNvbGxlY3Rpb25dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSB0aGlzLl9vcHRzLmNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhY3R1YWxNYXBwaW5nID0gY29sbGVjdGlvblt0aGlzLl9vcHRzLm1hcHBpbmddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWN0dWFsTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3B0cy5tYXBwaW5nID0gYWN0dWFsTWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNYXBwaW5nICcgKyB0aGlzLl9vcHRzLm1hcHBpbmcgKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiAnICsgdGhpcy5fb3B0cy5jb2xsZWN0aW9uICsgJyBkb2VzIG5vdCBleGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Bhc3NlZCBtYXBwaW5nIGFzIHN0cmluZywgYnV0IGRpZCBub3Qgc3BlY2lmeSB0aGUgY29sbGVjdGlvbiBpdCBiZWxvbmdzIHRvJywge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignRGVzY3JpcHRvcnMgbXVzdCBiZSBpbml0aWFsaXNlZCB3aXRoIGEgbWFwcGluZycsIHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIElmIGtleSBwYXRoLCBjb252ZXJ0IGRhdGEga2V5IHBhdGggaW50byBhbiBvYmplY3QgdGhhdCB3ZSBjYW4gdGhlbiB1c2UgdG8gdHJhdmVyc2UgdGhlIEhUVFAgYm9kaWVzLlxuICAgIC8vIG90aGVyd2lzZSBsZWF2ZSBhcyBzdHJpbmcgb3IgdW5kZWZpbmVkLlxuICAgIHZhciBkYXRhID0gdGhpcy5fb3B0cy5kYXRhO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJvb3Q7XG4gICAgICAgICAgICB2YXIgYXJyID0gZGF0YS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIHJvb3QgPSBhcnJbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgICAgICAgICByb290ID0gb2JqO1xuICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c0tleSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gYXJyW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PSAoYXJyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3ByZXZpb3VzS2V5XSA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzS2V5ID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fb3B0cy5kYXRhID0gcm9vdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHBhdGhcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3BhdGgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtZXRob2QnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3RyYW5zZm9ybXMnLCB0aGlzLl9vcHRzKTtcbn1cblxuRGVzY3JpcHRvci5wcm90b3R5cGUuaHR0cE1ldGhvZHMgPSBodHRwTWV0aG9kcztcblxuLyoqXG4gKiBUYWtlcyBhIHJlZ2V4IHBhdGggYW5kIHJldHVybnMgYW4gb2JqZWN0IGlmIG1hdGNoZWQuXG4gKiBJZiBhbnkgcmVndWxhciBleHByZXNzaW9uIGdyb3VwcyB3ZXJlIGRlZmluZWQsIHRoZSByZXR1cm5lZCBvYmplY3Qgd2lsbCBjb250YWluIHRoZSBtYXRjaGVzLlxuICpcbiAqIEBwYXJhbSAge1N0cmluZ3xSZWdFeHB9IHBhdGhcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBpbnRlcm5hbFxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAqICAgICBwYXRoOiAnL3Jlc291cmNlLyg/UDxpZD4pLydcbiAqIH0pXG4gKiB2YXIgbWF0Y2hlZCA9IGQuX21hdGNoUGF0aCgnL3Jlc291cmNlLzInKTtcbiAqIGNvbnNvbGUubG9nKG1hdGNoZWQpOyAvLyB7aWQ6ICcyJ31cbiAqIGBgYFxuICovXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hQYXRoID0gZnVuY3Rpb24ocGF0aCkge1xuICAgIHZhciBtYXRjaCA9IFhSZWdFeHAuZXhlYyhwYXRoLCB0aGlzLnBhdGgpO1xuICAgIHZhciBtYXRjaGVkID0gbnVsbDtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgbWF0Y2hlZCA9IHt9O1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIG1hdGNoKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2guaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNOYU4ocGFyc2VJbnQocHJvcCkpICYmIGlnbm9yZS5pbmRleE9mKHByb3ApIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkW3Byb3BdID0gbWF0Y2hbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVkO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGRlc2NyaXB0b3IgYWNjZXB0cyB0aGUgSFRUUCBtZXRob2QuXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSBtZXRob2RcbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKiBAaW50ZXJuYWxcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIGQgPSBuZXcgRGVzY3JpcHRvcih7XG4gKiAgICAgbWV0aG9kOiBbJ1BPU1QnLCAnUFVUJ11cbiAqIH0pO1xuICogY29uc29sZS5sb2coZC5fbWF0Y2hNZXRob2QoJ0dFVCcpKTsgLy8gZmFsc2VcbiAqIGBgYFxuICovXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hNZXRob2QgPSBmdW5jdGlvbihtZXRob2QpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIHRocm91Z2ggZGF0YSwgZW1iZWRkaW5nIG9iaiBpbiB0aGUgZmlyc3QgbGVhZi5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9ialxuICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGJ1cnkob2JqLCBkYXRhKSB7XG4gICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICB3aGlsZSAoISh0eXBlb2YoY3VycltrZXldKSA9PSAnc3RyaW5nJykpIHtcbiAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgfVxuICAgIHZhciBuZXdQYXJlbnQgPSBjdXJyW2tleV07XG4gICAgdmFyIG5ld09iaiA9IHt9O1xuICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICBuZXdPYmpbbmV3UGFyZW50XSA9IG9iajtcbiAgICByZXR1cm4gcm9vdDtcbn1cblxuRGVzY3JpcHRvci5wcm90b3R5cGUuX2VtYmVkRGF0YSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgIHZhciBuZXN0ZWQ7XG4gICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgbmVzdGVkID0ge307XG4gICAgICAgICAgICBuZXN0ZWRbdGhpcy5kYXRhXSA9IGRhdGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXN0ZWQgPSBidXJ5KGRhdGEsIGV4dGVuZCh0cnVlLCB7fSwgdGhpcy5kYXRhKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59O1xuXG4vKipcbiAqIElmIG5lc3RlZCBkYXRhIGhhcyBiZWVuIHNwZWNpZmllZCBpbiB0aGUgZGVzY3JpcHRvciwgZXh0cmFjdCB0aGUgZGF0YS5cbiAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnX2V4dHJhY3REYXRhJywgZGF0YSk7XG4gICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhW3RoaXMuZGF0YV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICB2YXIgY3VyclRoZWlycyA9IGRhdGE7XG4gICAgICAgICAgICB2YXIgY3Vyck91cnMgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICB3aGlsZSAodHlwZW9mKGN1cnJPdXJzKSAhPSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhjdXJyT3Vycyk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICAgICAgICAgIGN1cnJPdXJzID0gY3Vyck91cnNba2V5XTtcbiAgICAgICAgICAgICAgICBjdXJyVGhlaXJzID0gY3VyclRoZWlyc1trZXldO1xuICAgICAgICAgICAgICAgIGlmICghY3VyclRoZWlycykge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY3VyclRoZWlycyA/IGN1cnJUaGVpcnNbY3Vyck91cnNdIDogbnVsbDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICovXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hDb25maWcgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgbWF0Y2hlcyA9IGNvbmZpZy51cmwgPyB0aGlzLl9tYXRjaFBhdGgoY29uZmlnLnVybCkgOiB7fTtcbiAgICB9XG4gICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ21hdGNoZWQgY29uZmlnJyk7XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVzO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGRhdGEgaWYgdGhlIGRhdGEgbWF0Y2hlcywgcGVyZm9ybWluZyBhbnkgZXh0cmFjdGlvbiBhcyBzcGVjaWZpZWQgaW4gb3B0cy5kYXRhXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbkRlc2NyaXB0b3IucHJvdG90eXBlLl9tYXRjaERhdGEgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIGV4dHJhY3RlZERhdGEgPSBudWxsO1xuICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9leHRyYWN0RGF0YShkYXRhKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGV4dHJhY3RlZERhdGEgPSBkYXRhO1xuICAgIH1cbiAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICBMb2dnZXIudHJhY2UoJ21hdGNoZWQgZGF0YScpO1xuICAgIH1cbiAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIEhUVFAgY29uZmlnIGFuZCByZXR1cm5lZCBkYXRhIG1hdGNoIHRoaXMgZGVzY3JpcHRvciBkZWZpbml0aW9uLlxuICpcbiAqIEBwYXJhbSAge09iamVjdH0gY29uZmlnIENvbmZpZyBvYmplY3QgZm9yICQuYWpheCBhbmQgc2ltaWxhclxuICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gKiBAcmV0dXJuIHtPYmplY3R9IEV4dHJhY3RlZCBkYXRhXG4gKi9cbkRlc2NyaXB0b3IucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24oY29uZmlnLCBkYXRhKSB7XG4gICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgdmFyIG1hdGNoZXMgPSAhIXJlZ2V4TWF0Y2hlcztcbiAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IGZhbHNlO1xuICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIG1hdGNoZXMnKTtcbiAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX21hdGNoRGF0YShkYXRhKTtcbiAgICAgICAgbWF0Y2hlcyA9ICEhZXh0cmFjdGVkRGF0YTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIHZhciBrZXk7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGV4dHJhY3RlZERhdGEpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gcmVnZXhNYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWdleE1hdGNoZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGV4dHJhY3RlZERhdGEsIGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW1ba2V5XSA9IHJlZ2V4TWF0Y2hlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAoa2V5IGluIHJlZ2V4TWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVnZXhNYXRjaGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGFba2V5XSA9IHJlZ2V4TWF0Y2hlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdkYXRhIG1hdGNoZXMnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnZGF0YSBkb2VzbnQgbWF0Y2gnKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIGRvZXNudCBtYXRjaCcpO1xuICAgIH1cbiAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbn07XG5cbi8qKlxuICogQXBwbHkgYW55IHRyYW5zZm9ybXMuXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VyaWFsaXNlZCBkYXRhLlxuICogQHJldHVybiB7T2JqZWN0fSBTZXJpYWxpc2VkIGRhdGEgd2l0aCBhcHBsaWVkIHRyYW5zZm9ybWF0aW9ucy5cbiAqL1xuRGVzY3JpcHRvci5wcm90b3R5cGUuX3RyYW5zZm9ybURhdGEgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHRyYW5zZm9ybXMgPSB0aGlzLnRyYW5zZm9ybXM7XG4gICAgaWYgKHR5cGVvZih0cmFuc2Zvcm1zKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1zKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGF0dHIgaW4gdHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YVthdHRyXSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdHJhbnNmb3Jtc1thdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNwbGl0ID0gdHJhbnNmb3JtLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NwbGl0WzBdXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWwgPSBkYXRhW3NwbGl0WzBdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3QXR0ciA9IHNwbGl0W2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbbmV3QXR0cl0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbc3BsaXRbc3BsaXQubGVuZ3RoIC0gMV1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3RyYW5zZm9ybWVkWzBdXSA9IHRyYW5zZm9ybWVkWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2F0dHJdID0gdHJhbnNmb3JtZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignSW52YWxpZCB0cmFuc2Zvcm1lcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xufTtcblxuXG5leHBvcnRzLkRlc2NyaXB0b3IgPSBEZXNjcmlwdG9yO1xuZXhwb3J0cy5yZXNvbHZlTWV0aG9kID0gcmVzb2x2ZU1ldGhvZDsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsO1xudmFyIGxvZyA9IF9pLmxvZztcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3JSZWdpc3RyeScpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIGFzc2VydCA9IF9pLm1pc2MuYXNzZXJ0O1xuXG4vKipcbiAqIEBjbGFzcyBFbnRyeSBwb2ludCBmb3IgZGVzY3JpcHRvciByZWdpc3RyYXRpb24uXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvclJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3JSZWdpc3RyeShvcHRzKTtcbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbn1cblxuZnVuY3Rpb24gX3JlZ2lzdGVyRGVzY3JpcHRvcihkZXNjcmlwdG9ycywgZGVzY3JpcHRvcikge1xuICAgIHZhciBtYXBwaW5nID0gZGVzY3JpcHRvci5tYXBwaW5nO1xuICAgIHZhciBjb2xsZWN0aW9uID0gbWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIGFzc2VydChtYXBwaW5nKTtcbiAgICBhc3NlcnQoY29sbGVjdGlvbik7XG4gICAgYXNzZXJ0KHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyk7XG4gICAgaWYgKCFkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSkge1xuICAgICAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXS5wdXNoKGRlc2NyaXB0b3IpO1xufVxuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3IgPSBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCByZXF1ZXN0RGVzY3JpcHRvcik7XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yID0gZnVuY3Rpb24gKHJlc3BvbnNlRGVzY3JpcHRvcikge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIHJlc3BvbnNlRGVzY3JpcHRvcik7XG59O1xuXG5mdW5jdGlvbiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKGRlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICBpZiAodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dIHx8IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gKGRlc2NyaXB0b3JzW2NvbGxlY3Rpb24uX25hbWVdIHx8IFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbn1cblxuRGVzY3JpcHRvclJlZ2lzdHJ5LnByb3RvdHlwZS5yZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICByZXR1cm4gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gcmVzcG9uc2UgZGVzY3JpcHRvcnMgZm9yIGNvbGxlY3Rpb24gJywgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzKTtcbiAgICB9XG4gICAgcmV0dXJuICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG59O1xuXG5leHBvcnRzLkRlc2NyaXB0b3JSZWdpc3RyeSA9IG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkoKTsiLCIvKipcbiAqIFByb3Zpc2lvbnMgdXNhZ2Ugb2YgJC5hamF4IGFuZCBzaW1pbGFyIGZ1bmN0aW9ucyB0byBzZW5kIEhUVFAgcmVxdWVzdHMgbWFwcGluZ1xuICogdGhlIHJlc3VsdHMgYmFjayBvbnRvIHRoZSBvYmplY3QgZ3JhcGggYXV0b21hdGljYWxseS5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbmlmICghc2llc3RhKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBzaWVzdGEnKTtcbn1cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBDb2xsZWN0aW9uID0gc2llc3RhLkNvbGxlY3Rpb24sXG4gICAgbG9nID0gX2kubG9nLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIGRlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBxID0gX2kucTtcblxudmFyIERlc2NyaXB0b3JSZWdpc3RyeSA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5O1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdIVFRQJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGNhbGxiYWNrO1xuICAgIHZhciBvcHRzID0ge307XG4gICAgdmFyIG5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIGlmICghb3B0cy51cmwpIHsgLy8gQWxsb3cgb3ZlcnJpZGVzLlxuICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICB9XG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSB0cnVlO1xuICAgIG9wdHMuc3VjY2VzcyA9IGZ1bmN0aW9uKGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKG9wdHMudHlwZSArICcgJyArIGpxWEhSLnN0YXR1cyArICcgJyArIG9wdHMudXJsICsgJzogJyArIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDQpKTtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgdGV4dFN0YXR1czogdGV4dFN0YXR1cyxcbiAgICAgICAgICAgIGpxWEhSOiBqcVhIUlxuICAgICAgICB9O1xuICAgICAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24oc2VsZik7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvcnNbaV07XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Rlc2NyaXB0b3InLCBkZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGVzY3JpcHRvci5tYXRjaChvcHRzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWFwcGluZyBleHRyYWN0ZWQgZGF0YTogJyArIEpTT04uc3RyaW5naWZ5KGV4dHJhY3RlZERhdGEsIG51bGwsIDQpKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGV4dHJhY3RlZERhdGEpID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gbWF0Y2hlZERlc2NyaXB0b3IubWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5tYXAoZXh0cmFjdGVkRGF0YSwgZnVuY3Rpb24oZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBvYmosIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRzLm9iaik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gTWF0Y2hlZCwgYnV0IG5vIGRhdGEuXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRydWUsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSB3YXMgYSBidWcgd2hlcmUgY29sbGVjdGlvbiBuYW1lIGRvZXNuJ3QgZXhpc3QuIElmIHRoaXMgb2NjdXJzLCB0aGVuIHdpbGwgbmV2ZXIgZ2V0IGhvbGQgb2YgYW55IGRlc2NyaXB0b3JzLlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5uYW1lZCBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgcmVzcCk7XG4gICAgICAgIH1cblxuICAgIH07XG4gICAgb3B0cy5lcnJvciA9IGZ1bmN0aW9uKGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xuICAgICAgICB2YXIgcmVzcCA9IHtcbiAgICAgICAgICAgIGpxWEhSOiBqcVhIUixcbiAgICAgICAgICAgIHRleHRTdGF0dXM6IHRleHRTdGF0dXMsXG4gICAgICAgICAgICBlcnJvclRocm93bjogZXJyb3JUaHJvd25cbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXNwLCBudWxsLCByZXNwKTtcbiAgICB9O1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ0FqYXggcmVxdWVzdDonLCBvcHRzKTtcbiAgICAkLmFqYXgob3B0cyk7XG59O1xuXG5mdW5jdGlvbiBfc2VyaWFsaXNlT2JqZWN0KG9wdHMsIG9iaiwgY2IpIHtcbiAgICB0aGlzLl9zZXJpYWxpc2Uob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgIHZhciByZXREYXRhID0gZGF0YTtcbiAgICAgICAgaWYgKG9wdHMuZmllbGRzKSB7XG4gICAgICAgICAgICByZXREYXRhID0ge307XG4gICAgICAgICAgICBfLmVhY2gob3B0cy5maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgcmV0RGF0YVtmXSA9IGRhdGFbZl07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHJldERhdGEpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aFxuICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBvYmplY3QgVGhlIG1vZGVsIHdlJ3JlIHB1c2hpbmcgdG8gdGhlIHNlcnZlclxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlcXVlc3QobWV0aG9kLCBwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuICAgIHZhciBjYWxsYmFjaztcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpO1xuICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzKTtcbiAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIHZhciBiYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0RGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlcXVlc3REZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3JzW2ldO1xuICAgICAgICBpZiAocmVxdWVzdERlc2NyaXB0b3IuX21hdGNoQ29uZmlnKG9wdHMpKSB7XG4gICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIGRlc2NyaXB0b3I6ICcgKyBtYXRjaGVkRGVzY3JpcHRvci5fZHVtcCh0cnVlKSk7XG4gICAgICAgIF9zZXJpYWxpc2VPYmplY3QuY2FsbChtYXRjaGVkRGVzY3JpcHRvciwgb2JqZWN0LCBvcHRzLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnLCB7XG4gICAgICAgICAgICAgICAgICAgIGVycjogZXJyLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIG51bGwsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRzLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIG9wdHMub2JqID0gb2JqZWN0O1xuICAgICAgICAgICAgICAgIF8ucGFydGlhbChfaHR0cFJlc3BvbnNlLCBtZXRob2QsIHBhdGgsIG9wdHMsIGNhbGxiYWNrKS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgXG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRGlkIG5vdCBtYXRjaCBkZXNjcmlwdG9yJyk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwsIG51bGwpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogU2VuZCBhIERFTEVURSByZXF1ZXN0LiBBbHNvIHJlbW92ZXMgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdGlybmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gREVMRVRFXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBBVENIXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gREVMRVRFKGNvbGxlY3Rpb24sIHBhdGgsIG9iamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkZWxldGlvbk1vZGUgPSBvcHRzLmRlbGV0aW9uTW9kZSB8fCAncmVzdG9yZSc7XG4gICAgLy8gQnkgZGVmYXVsdCB3ZSBkbyBub3QgbWFwIHRoZSByZXNwb25zZSBmcm9tIGEgREVMRVRFIHJlcXVlc3QuXG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSBmYWxzZTtcbiAgICBfaHR0cFJlc3BvbnNlLmNhbGwoY29sbGVjdGlvbiwgJ0RFTEVURScsIHBhdGgsIG9wdHMsIGZ1bmN0aW9uKGVyciwgeCwgeSwgeikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICAgICAgICAgIG9iamVjdC5yZXN0b3JlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGVsZXRpb25Nb2RlID09ICdzdWNjZXNzJykge1xuICAgICAgICAgICAgb2JqZWN0LnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVyciwgeCwgeSwgeik7XG4gICAgfSk7XG4gICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAnbm93JyB8fCBkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSByZXF1ZXN0IERvZXMgdGhlIHJlcXVlc3QgY29udGFpbiBkYXRhPyBlLmcuIFBPU1QvUEFUQ0gvUFVUIHdpbGwgYmUgdHJ1ZSwgR0VUIHdpbGwgZmFsc2VcbiAqIEBwYXJhbSBtZXRob2RcbiAqIEBpbnRlcm5hbFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhUVFBfTUVUSE9EKGNvbGxlY3Rpb24sIHJlcXVlc3QsIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHJlcXVlc3QgPyBfaHR0cFJlcXVlc3QgOiBfaHR0cFJlc3BvbnNlLCBtZXRob2QpLmFwcGx5KGNvbGxlY3Rpb24sIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBHRVQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ0dFVCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gT1BUSU9OUyByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIE9QVElPTlMoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ09QVElPTlMnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFRSQUNFIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gVFJBQ0UoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ1RSQUNFJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBIRUFEIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gSEVBRChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIGZhbHNlLCAnSEVBRCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUE9TVCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUE9TVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQVVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBVVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBBVENIIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQQVRDSChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG52YXIgYWpheDtcblxuaWYgKCFzaWVzdGEuZXh0KSB7XG4gICAgc2llc3RhLmV4dCA9IHt9O1xufVxuXG5cblxuc2llc3RhLmV4dC5odHRwID0ge1xuICAgIFJlcXVlc3REZXNjcmlwdG9yOiByZXF1aXJlKCcuL3JlcXVlc3REZXNjcmlwdG9yJykuUmVxdWVzdERlc2NyaXB0b3IsXG4gICAgUmVzcG9uc2VEZXNjcmlwdG9yOiByZXF1aXJlKCcuL3Jlc3BvbnNlRGVzY3JpcHRvcicpLlJlc3BvbnNlRGVzY3JpcHRvcixcbiAgICBEZXNjcmlwdG9yOiBkZXNjcmlwdG9yLkRlc2NyaXB0b3IsXG4gICAgX3Jlc29sdmVNZXRob2Q6IGRlc2NyaXB0b3IucmVzb2x2ZU1ldGhvZCxcbiAgICBTZXJpYWxpc2VyOiByZXF1aXJlKCcuL3NlcmlhbGlzZXInKSxcbiAgICBEZXNjcmlwdG9yUmVnaXN0cnk6IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5LFxuICAgIHNldEFqYXg6IGZ1bmN0aW9uKF9hamF4KSB7XG4gICAgICAgIGFqYXggPSBfYWpheDtcbiAgICB9LFxuICAgIF9odHRwUmVzcG9uc2U6IF9odHRwUmVzcG9uc2UsXG4gICAgX2h0dHBSZXF1ZXN0OiBfaHR0cFJlcXVlc3QsXG4gICAgREVMRVRFOiBERUxFVEUsXG4gICAgSFRUUF9NRVRIT0Q6IEhUVFBfTUVUSE9ELFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0gsXG4gICAgX3NlcmlhbGlzZU9iamVjdDogX3NlcmlhbGlzZU9iamVjdFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YS5leHQuaHR0cCwgJ2FqYXgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGEgPSBhamF4IHx8ICgkID8gJC5hamF4IDogbnVsbCkgfHwgKGpRdWVyeSA/IGpRdWVyeS5hamF4IDogbnVsbCk7XG4gICAgICAgIGlmICghYSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ2FqYXggaGFzIG5vdCBiZWVuIGRlZmluZWQgYW5kIGNvdWxkIG5vdCBmaW5kICQuYWpheCBvciBqUXVlcnkuYWpheCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIGFqYXggPSB2O1xuICAgIH1cbn0pOyIsIi8qKlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yXG4gICAgLCBTZXJpYWxpc2VyID0gcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyk7XG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAsIHEgPSBfaS5xXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IF9pLm1pc2MuZGVmaW5lU3ViUHJvcGVydHlcbjtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUmVxdWVzdERlc2NyaXB0b3InKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICogQGNsYXNzIERlc2NyaWJlcyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5fb3B0c1snc2VyaWFsaXplciddKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX29wdHMuc2VyaWFsaXNlcikge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSBTZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcigwKTtcbiAgICB9XG5cblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGlzZXInLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpemVyJywgdGhpcy5fb3B0cywgJ3NlcmlhbGlzZXInKTtcblxufVxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUuX3NlcmlhbGlzZSA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICB2YXIgZmluaXNoZWQ7XG4gICAgdmFyIGRhdGEgPSB0aGlzLnNlcmlhbGlzZXIob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIGRvZXNudCB1c2UgYSBjYWxsYmFjaycpO1xuICAgICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciB1c2VzIGEgY2FsbGJhY2snLCB0aGlzLnNlcmlhbGlzZXIpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cblJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICBvYmoubWFwcGluZyA9IHRoaXMubWFwcGluZy50eXBlO1xuICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgIHZhciBzZXJpYWxpc2VyO1xuICAgIGlmICh0eXBlb2YodGhpcy5fcmF3T3B0cy5zZXJpYWxpc2VyKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHNlcmlhbGlzZXIgPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHNlcmlhbGlzZXIgPSB0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXI7XG4gICAgfVxuICAgIG9iai5zZXJpYWxpc2VyID0gc2VyaWFsaXNlcjtcbiAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoZikpIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xufTtcblxuZXhwb3J0cy5SZXF1ZXN0RGVzY3JpcHRvciA9IFJlcXVlc3REZXNjcmlwdG9yO1xuIiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcjtcblxuLyoqXG4gKiBEZXNjcmliZXMgd2hhdCB0byBkbyB3aXRoIGEgSFRUUCByZXNwb25zZS5cbiAqIEBjb25zdHJ1Y3RvclxuICogQGltcGxlbWVudHMge0Rlc2NyaXB0b3J9XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBSZXNwb25zZURlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG4gICAgRGVzY3JpcHRvci5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5SZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEZXNjcmlwdG9yLnByb3RvdHlwZSk7XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUuX2V4dHJhY3REYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IERlc2NyaXB0b3IucHJvdG90eXBlLl9leHRyYWN0RGF0YS5jYWxsKHRoaXMsIGRhdGEpO1xuICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbn07XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUuX21hdGNoRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX3RyYW5zZm9ybURhdGEoZXh0cmFjdGVkRGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xufTtcblxuUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICBvYmoubWFwcGluZyA9IHRoaXMubWFwcGluZy50eXBlO1xuICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgZm9yICh2YXIgZiBpbiB0aGlzLnRyYW5zZm9ybXMpIHtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgcmV0dXJuIGFzSnNvbiA/IEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgNCkgOiBvYmo7XG59O1xuXG5leHBvcnRzLlJlc3BvbnNlRGVzY3JpcHRvciA9IFJlc3BvbnNlRGVzY3JpcHRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWw7XG5cbnZhciBsb2cgPSBfaS5sb2dcbiAgICAsIHV0aWxzID0gX2kudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzZXInKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgXyA9IHV0aWxzLl87XG5cbi8qKlxuICogU2VyaWFsaXNlcyBhbiBvYmplY3QgaW50byBpdCdzIHJlbW90ZSBpZGVudGlmaWVyIChhcyBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKVxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICogXG4gKi9cbmZ1bmN0aW9uIGlkU2VyaWFsaXNlcihvYmopIHtcbiAgICB2YXIgaWRGaWVsZCA9IG9iai5tYXBwaW5nLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9ICAgb2JqXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZG9uZSBcbiAqL1xuZnVuY3Rpb24gZGVwdGhTZXJpYWxpc2VyKGRlcHRoLCBvYmosIGRvbmUpIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgTG9nZ2VyLnRyYWNlKCdkZXB0aFNlcmlhbGlzZXInKTtcbiAgICB2YXIgZGF0YSA9IHt9O1xuICAgIF8uZWFjaChvYmouX2ZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2ZpZWxkJywgZik7XG4gICAgICAgIGlmIChvYmpbZl0pIHtcbiAgICAgICAgICAgIGRhdGFbZl0gPSBvYmpbZl07XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgd2FpdGluZyA9IFtdO1xuICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGZpbmlzaGVkID0gW107XG4gICAgXy5lYWNoKG9iai5fcmVsYXRpb25zaGlwRmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqW2YgKyAnUHJveHknXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmpbZiArICdQcm94eSddLmZvcndhcmRNYXBwaW5nLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zygnbm8gdmFsdWUgZm9yICcgKyBmKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghd2FpdGluZy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGRvbmUpIGRvbmUobnVsbCwgZGF0YSwge30pO1xuICAgIH1cbn1cblxuXG5leHBvcnRzLmRlcHRoU2VyaWFsaXNlciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuICBfLnBhcnRpYWwoZGVwdGhTZXJpYWxpc2VyLCBkZXB0aCk7XG59O1xuZXhwb3J0cy5pZFNlcmlhbGl6ZXIgPSBpZFNlcmlhbGlzZXI7XG5leHBvcnRzLmlkU2VyaWFsaXNlciA9IGlkU2VyaWFsaXNlcjtcblxuIl19
