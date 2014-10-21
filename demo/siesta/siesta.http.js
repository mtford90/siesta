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
var _i = siesta._internal
    , log = _i.log
    , RestError = _i.error.RestError
    , assert = _i.misc.assert
    , defineSubProperty = _i.misc.defineSubProperty
    , CollectionRegistry = _i.CollectionRegistry
    , extend = _i.extend
    , util = _i.util
    , _ = util._
    ;

var Logger = log.loggerWithName('Descriptor');
Logger.setLevel(log.Level.warn);
// The XRegExp object has these properties that we want to ignore when matching.
var ignore = ['index', 'input'];
var XRegExp = require('xregexp').XRegExp;


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
    }
    else {
        this._opts.path = '';
    }

    // Convert wildcards into methods and ensure is an array of uppercase methods.
    if (this._opts.method) {
        if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
            this._opts.method = this.httpMethods;
        }
        else if (typeof(this._opts.method) == 'string') {
            this._opts.method = [this._opts.method];
        }
    }
    else {
        this._opts.method = this.httpMethods;
    }
    this._opts.method = _.map(this._opts.method, function (x) {return x.toUpperCase()});

    // Mappings can be passed as the actual mapping object or as a string (with API specified too)
    if (this._opts.mapping) {
        if (typeof(this._opts.mapping) == 'string') {
            if (this._opts.collection) {
                var collection;
                if (typeof(this._opts.collection) == 'string') {
                    collection = CollectionRegistry[this._opts.collection];
                }
                else {
                    collection = this._opts.collection;
                }
                if (collection) {
                    var actualMapping = collection[this._opts.mapping];
                    if (actualMapping) {
                        this._opts.mapping = actualMapping;
                    }
                    else {
                        throw new RestError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts, descriptor: this});
                    }
                }
                else {
                    throw new RestError('Collection ' + this._opts.collection + ' does not exist', {opts: opts, descriptor: this});
                }
            }
            else {
                throw new RestError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts, descriptor: this});
            }
        }
    }
    else {
        throw new RestError('Descriptors must be initialised with a mapping', {opts: opts, descriptor: this});
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
            }
            else {
                var obj = {};
                root = obj;
                var previousKey = arr[0];
                for (var i = 1; i < arr.length; i++) {
                    var key = arr[i];
                    if (i == (arr.length - 1)) {
                        obj[previousKey] = key;
                    }
                    else {
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

    defineSubProperty.call(this, 'path', this._opts);
    defineSubProperty.call(this, 'method', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'transforms', this._opts);
}

Descriptor.prototype.httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

Descriptor.prototype._matchPath = function (path) {
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

Descriptor.prototype._matchMethod = function (method) {
    for (var i = 0; i < this.method.length; i++) {
        if (method.toUpperCase() == this.method[i]) {
            return true;
        }
    }
    return false;
};

/**
 * Bury obj as far down in data as poss.
 * @param obj
 * @param data keypath object
 * @returns {*}
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

Descriptor.prototype._embedData = function (data) {
    if (this.data) {
        var nested;
        if (typeof(this.data) == 'string') {
            nested = {};
            nested[this.data] = data;
        }
        else {
            nested = bury(data, extend(true, {}, this.data));
        }
        return nested;
    }
    else {
        return data;
    }
};

Descriptor.prototype._extractData = function (data) {
    if (Logger.debug.isEnabled)
        Logger.debug('_extractData', data);
    if (this.data) {
        if (typeof(this.data) == 'string') {
            return data[this.data];
        }
        else {
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
    }
    else {
        return data;
    }
};

/**
 * Returns this descriptors mapping if the request config matches.
 * @param config
 * @returns {*}
 * @private
 */
Descriptor.prototype._matchConfig = function (config) {
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

Descriptor.prototype._matchData = function (data) {
    var extractedData = null;
    if (this.data) {
        if (data) {
            extractedData = this._extractData(data);
        }
    }
    else {
        extractedData = data;
    }
    if (extractedData) {
        Logger.trace('matched data');
    }
    return extractedData;
};

Descriptor.prototype.match = function (config, data) {
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
                        _.each(extractedData, function (datum) {
                            datum[key] = regexMatches[key];
                        });
                    }
                }
            }
            else {
                for (key in regexMatches) {
                    if (regexMatches.hasOwnProperty(key)) {
                        extractedData[key] = regexMatches[key];
                    }
                }
            }

            Logger.trace('data matches');
        }
        else {
            Logger.trace('data doesnt match');
        }
    }
    else {
        Logger.trace('config doesnt match');
    }
    return extractedData;
};

Descriptor.prototype._transformData = function (data) {
    var transforms = this.transforms;
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
                    }
                    else {
                        data[split[0]] = {};
                        var newVal = data[split[0]];
                        for (var i = 1; i < split.length - 1; i++) {
                            var newAttr = split[i];
                            newVal[newAttr] = {};
                            newVal = newVal[newAttr];
                        }
                        newVal[split[split.length - 1]] = val;
                    }
                }
                else if (typeof(transform) == 'function') {
                    var transformed = transform(val);
                    if (util.isArray(transformed)) {
                        delete data[attr];
                        data[transformed[0]] = transformed[1];
                    }
                    else {
                        data[attr] = transformed;
                    }
                }
                else {
                    throw new RestError('Invalid transformer');
                }
            }
        }
    }
};


exports.Descriptor = Descriptor;
},{"xregexp":1}],3:[function(require,module,exports){
var _i = siesta._internal;
var log = _i.log;
var Logger = log.loggerWithName('DescriptorRegistry');
Logger.setLevel(log.Level.warn);

var assert = _i.misc.assert;


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
(function () {
    if (!siesta) {
        throw new Error('Could not find siesta');
    }

    var Collection = siesta.Collection
        , log = siesta._internal.log
        , util = siesta._internal.util
        , q = siesta._internal.q
        ;

    var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;

    var Logger = log.loggerWithName('HTTP');
    Logger.setLevel(log.Level.warn);

    if (!siesta.ext) {
        siesta.ext = {};
    }

    siesta.ext.http = {
        RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
        ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
        Descriptor: require('./descriptor').Descriptor,
        Serialiser: require('./serialiser'),
        DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry
    };

    Collection.prototype._httpResponse = function (method, path) {
        var self = this;
        var args = Array.prototype.slice.call(arguments, 2);
        var callback;
        var opts = {};
        var name = this._name;
        if (typeof(args[0]) == 'function') {
            callback = args[0];
        }
        else if (typeof (args[0]) == 'object') {
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
        opts.success = function (data, textStatus, jqXHR) {
            if (Logger.trace.isEnabled)
                Logger.trace(opts.type + ' ' + jqXHR.status + ' ' + opts.url + ': ' + JSON.stringify(data, null, 4));
            var resp = {data: data, textStatus: textStatus, jqXHR: jqXHR};
            var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
            var matchedDescriptor;
            var extractedData;

            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
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
                    mapping.map(extractedData, function (err, obj) {
                        if (callback) {
                            callback(err, obj, resp);
                        }
                    }, opts.obj);
                }
                else { // Matched, but no data.
                    callback(null, true, resp);
                }
            }
            else if (callback) {
                if (name) {
                    callback(null, null, resp);
                }
                else {
                    // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                    throw new RestError('Unnamed collection');
                }

            }
        };
        opts.error = function (jqXHR, textStatus, errorThrown) {
            var resp = {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown};
            if (callback) callback(resp, null, resp);
        };
        $.ajax(opts);
    };
    Collection.prototype._httpRequest = function (method, path, object) {
        var self = this;
        var args = Array.prototype.slice.call(arguments, 2);
        var callback;
        var opts = {};
        if (typeof(args[0]) == 'function') {
            callback = args[0];
        }
        else if (typeof (args[0]) == 'object') {
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
            matchedDescriptor._serialise(object, function (err, data) {
                if (Logger.trace.isEnabled)
                    Logger.trace('_serialise', {err: err, data: data});
                if (err) {
                    if (callback) callback(err, null, null);
                }
                else {
                    opts.data = data;
                    opts.obj = object;
                    _.partial(self._httpResponse, method, path, opts, callback).apply(self, args);
                }
            });
        }
        else if (callback) {
            if (Logger.trace.isEnabled)
                Logger.trace('Did not match descriptor');
            callback(null, null, null);
        }
        return deferred.promise;
    };

})();
},{"./descriptor":2,"./descriptorRegistry":3,"./requestDescriptor":5,"./responseDescriptor":6,"./serialiser":7}],5:[function(require,module,exports){
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
            self._transformData(data);
            if (callback) callback(err, self._embedData(data));
        }
    });
    if (data !== undefined) {
        if (Logger.trace.isEnabled)
            Logger.trace('serialiser doesnt use a callback');
        finished = true;
        self._transformData(data);
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
var Descriptor = require('./descriptor').Descriptor;

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
        this._transformData(extractedData);
    }
    return extractedData;
};

ResponseDescriptor.prototype._matchData = function (data) {
    var extractedData = Descriptor.prototype._matchData.call(this, data);
    if (extractedData) {
        this._transformData(extractedData);
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
var _i = siesta._internal;

var log = _i.log
    , utils = _i.util;
var Logger = log.loggerWithName('Serialiser');
Logger.setLevel(log.Level.warn);
var _ = utils._;

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMveHJlZ2V4cC94cmVnZXhwLWFsbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9kZXNjcmlwdG9yUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9odHRwLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9yZXNwb25zZURlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9zZXJpYWxpc2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwd0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuLyoqKioqIHhyZWdleHAuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwIHYyLjAuMFxyXG4gKiAoYykgMjAwNy0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICovXHJcblxyXG4vKipcclxuICogWFJlZ0V4cCBwcm92aWRlcyBhdWdtZW50ZWQsIGV4dGVuc2libGUgSmF2YVNjcmlwdCByZWd1bGFyIGV4cHJlc3Npb25zLiBZb3UgZ2V0IG5ldyBzeW50YXgsXHJcbiAqIGZsYWdzLCBhbmQgbWV0aG9kcyBiZXlvbmQgd2hhdCBicm93c2VycyBzdXBwb3J0IG5hdGl2ZWx5LiBYUmVnRXhwIGlzIGFsc28gYSByZWdleCB1dGlsaXR5IGJlbHRcclxuICogd2l0aCB0b29scyB0byBtYWtlIHlvdXIgY2xpZW50LXNpZGUgZ3JlcHBpbmcgc2ltcGxlciBhbmQgbW9yZSBwb3dlcmZ1bCwgd2hpbGUgZnJlZWluZyB5b3UgZnJvbVxyXG4gKiB3b3JyeWluZyBhYm91dCBwZXNreSBjcm9zcy1icm93c2VyIGluY29uc2lzdGVuY2llcyBhbmQgdGhlIGR1YmlvdXMgYGxhc3RJbmRleGAgcHJvcGVydHkuIFNlZVxyXG4gKiBYUmVnRXhwJ3MgZG9jdW1lbnRhdGlvbiAoaHR0cDovL3hyZWdleHAuY29tLykgZm9yIG1vcmUgZGV0YWlscy5cclxuICogQG1vZHVsZSB4cmVnZXhwXHJcbiAqIEByZXF1aXJlcyBOL0FcclxuICovXHJcbnZhciBYUmVnRXhwO1xyXG5cclxuLy8gQXZvaWQgcnVubmluZyB0d2ljZTsgdGhhdCB3b3VsZCByZXNldCB0b2tlbnMgYW5kIGNvdWxkIGJyZWFrIHJlZmVyZW5jZXMgdG8gbmF0aXZlIGdsb2JhbHNcclxuWFJlZ0V4cCA9IFhSZWdFeHAgfHwgKGZ1bmN0aW9uICh1bmRlZikge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBQcml2YXRlIHZhcmlhYmxlc1xyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgdmFyIHNlbGYsXHJcbiAgICAgICAgYWRkVG9rZW4sXHJcbiAgICAgICAgYWRkLFxyXG5cclxuLy8gT3B0aW9uYWwgZmVhdHVyZXM7IGNhbiBiZSBpbnN0YWxsZWQgYW5kIHVuaW5zdGFsbGVkXHJcbiAgICAgICAgZmVhdHVyZXMgPSB7XHJcbiAgICAgICAgICAgIG5hdGl2ZXM6IGZhbHNlLFxyXG4gICAgICAgICAgICBleHRlbnNpYmlsaXR5OiBmYWxzZVxyXG4gICAgICAgIH0sXHJcblxyXG4vLyBTdG9yZSBuYXRpdmUgbWV0aG9kcyB0byB1c2UgYW5kIHJlc3RvcmUgKFwibmF0aXZlXCIgaXMgYW4gRVMzIHJlc2VydmVkIGtleXdvcmQpXHJcbiAgICAgICAgbmF0aXYgPSB7XHJcbiAgICAgICAgICAgIGV4ZWM6IFJlZ0V4cC5wcm90b3R5cGUuZXhlYyxcclxuICAgICAgICAgICAgdGVzdDogUmVnRXhwLnByb3RvdHlwZS50ZXN0LFxyXG4gICAgICAgICAgICBtYXRjaDogU3RyaW5nLnByb3RvdHlwZS5tYXRjaCxcclxuICAgICAgICAgICAgcmVwbGFjZTogU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlLFxyXG4gICAgICAgICAgICBzcGxpdDogU3RyaW5nLnByb3RvdHlwZS5zcGxpdFxyXG4gICAgICAgIH0sXHJcblxyXG4vLyBTdG9yYWdlIGZvciBmaXhlZC9leHRlbmRlZCBuYXRpdmUgbWV0aG9kc1xyXG4gICAgICAgIGZpeGVkID0ge30sXHJcblxyXG4vLyBTdG9yYWdlIGZvciBjYWNoZWQgcmVnZXhlc1xyXG4gICAgICAgIGNhY2hlID0ge30sXHJcblxyXG4vLyBTdG9yYWdlIGZvciBhZGRvbiB0b2tlbnNcclxuICAgICAgICB0b2tlbnMgPSBbXSxcclxuXHJcbi8vIFRva2VuIHNjb3Blc1xyXG4gICAgICAgIGRlZmF1bHRTY29wZSA9IFwiZGVmYXVsdFwiLFxyXG4gICAgICAgIGNsYXNzU2NvcGUgPSBcImNsYXNzXCIsXHJcblxyXG4vLyBSZWdleGVzIHRoYXQgbWF0Y2ggbmF0aXZlIHJlZ2V4IHN5bnRheFxyXG4gICAgICAgIG5hdGl2ZVRva2VucyA9IHtcclxuICAgICAgICAgICAgLy8gQW55IG5hdGl2ZSBtdWx0aWNoYXJhY3RlciB0b2tlbiBpbiBkZWZhdWx0IHNjb3BlIChpbmNsdWRlcyBvY3RhbHMsIGV4Y2x1ZGVzIGNoYXJhY3RlciBjbGFzc2VzKVxyXG4gICAgICAgICAgICBcImRlZmF1bHRcIjogL14oPzpcXFxcKD86MCg/OlswLTNdWzAtN117MCwyfXxbNC03XVswLTddPyk/fFsxLTldXFxkKnx4W1xcZEEtRmEtZl17Mn18dVtcXGRBLUZhLWZdezR9fGNbQS1aYS16XXxbXFxzXFxTXSl8XFwoXFw/Wzo9IV18Wz8qK11cXD98e1xcZCsoPzosXFxkKik/fVxcPz8pLyxcclxuICAgICAgICAgICAgLy8gQW55IG5hdGl2ZSBtdWx0aWNoYXJhY3RlciB0b2tlbiBpbiBjaGFyYWN0ZXIgY2xhc3Mgc2NvcGUgKGluY2x1ZGVzIG9jdGFscylcclxuICAgICAgICAgICAgXCJjbGFzc1wiOiAvXig/OlxcXFwoPzpbMC0zXVswLTddezAsMn18WzQtN11bMC03XT98eFtcXGRBLUZhLWZdezJ9fHVbXFxkQS1GYS1mXXs0fXxjW0EtWmEtel18W1xcc1xcU10pKS9cclxuICAgICAgICB9LFxyXG5cclxuLy8gQW55IGJhY2tyZWZlcmVuY2UgaW4gcmVwbGFjZW1lbnQgc3RyaW5nc1xyXG4gICAgICAgIHJlcGxhY2VtZW50VG9rZW4gPSAvXFwkKD86eyhbXFx3JF0rKX18KFxcZFxcZD98W1xcc1xcU10pKS9nLFxyXG5cclxuLy8gQW55IGNoYXJhY3RlciB3aXRoIGEgbGF0ZXIgaW5zdGFuY2UgaW4gdGhlIHN0cmluZ1xyXG4gICAgICAgIGR1cGxpY2F0ZUZsYWdzID0gLyhbXFxzXFxTXSkoPz1bXFxzXFxTXSpcXDEpL2csXHJcblxyXG4vLyBBbnkgZ3JlZWR5L2xhenkgcXVhbnRpZmllclxyXG4gICAgICAgIHF1YW50aWZpZXIgPSAvXig/Ols/KitdfHtcXGQrKD86LFxcZCopP30pXFw/Py8sXHJcblxyXG4vLyBDaGVjayBmb3IgY29ycmVjdCBgZXhlY2AgaGFuZGxpbmcgb2Ygbm9ucGFydGljaXBhdGluZyBjYXB0dXJpbmcgZ3JvdXBzXHJcbiAgICAgICAgY29tcGxpYW50RXhlY05wY2cgPSBuYXRpdi5leGVjLmNhbGwoLygpPz8vLCBcIlwiKVsxXSA9PT0gdW5kZWYsXHJcblxyXG4vLyBDaGVjayBmb3IgZmxhZyB5IHN1cHBvcnQgKEZpcmVmb3ggMyspXHJcbiAgICAgICAgaGFzTmF0aXZlWSA9IFJlZ0V4cC5wcm90b3R5cGUuc3RpY2t5ICE9PSB1bmRlZixcclxuXHJcbi8vIFVzZWQgdG8ga2lsbCBpbmZpbml0ZSByZWN1cnNpb24gZHVyaW5nIFhSZWdFeHAgY29uc3RydWN0aW9uXHJcbiAgICAgICAgaXNJbnNpZGVDb25zdHJ1Y3RvciA9IGZhbHNlLFxyXG5cclxuLy8gU3RvcmFnZSBmb3Iga25vd24gZmxhZ3MsIGluY2x1ZGluZyBhZGRvbiBmbGFnc1xyXG4gICAgICAgIHJlZ2lzdGVyZWRGbGFncyA9IFwiZ2ltXCIgKyAoaGFzTmF0aXZlWSA/IFwieVwiIDogXCJcIik7XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBQcml2YXRlIGhlbHBlciBmdW5jdGlvbnNcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLyoqXHJcbiAqIEF0dGFjaGVzIFhSZWdFeHAucHJvdG90eXBlIHByb3BlcnRpZXMgYW5kIG5hbWVkIGNhcHR1cmUgc3VwcG9ydGluZyBkYXRhIHRvIGEgcmVnZXggb2JqZWN0LlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gYXVnbWVudC5cclxuICogQHBhcmFtIHtBcnJheX0gY2FwdHVyZU5hbWVzIEFycmF5IHdpdGggY2FwdHVyZSBuYW1lcywgb3IgbnVsbC5cclxuICogQHBhcmFtIHtCb29sZWFufSBbaXNOYXRpdmVdIFdoZXRoZXIgdGhlIHJlZ2V4IHdhcyBjcmVhdGVkIGJ5IGBSZWdFeHBgIHJhdGhlciB0aGFuIGBYUmVnRXhwYC5cclxuICogQHJldHVybnMge1JlZ0V4cH0gQXVnbWVudGVkIHJlZ2V4LlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGF1Z21lbnQocmVnZXgsIGNhcHR1cmVOYW1lcywgaXNOYXRpdmUpIHtcclxuICAgICAgICB2YXIgcDtcclxuICAgICAgICAvLyBDYW4ndCBhdXRvLWluaGVyaXQgdGhlc2Ugc2luY2UgdGhlIFhSZWdFeHAgY29uc3RydWN0b3IgcmV0dXJucyBhIG5vbnByaW1pdGl2ZSB2YWx1ZVxyXG4gICAgICAgIGZvciAocCBpbiBzZWxmLnByb3RvdHlwZSkge1xyXG4gICAgICAgICAgICBpZiAoc2VsZi5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkocCkpIHtcclxuICAgICAgICAgICAgICAgIHJlZ2V4W3BdID0gc2VsZi5wcm90b3R5cGVbcF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmVnZXgueHJlZ2V4cCA9IHtjYXB0dXJlTmFtZXM6IGNhcHR1cmVOYW1lcywgaXNOYXRpdmU6ICEhaXNOYXRpdmV9O1xyXG4gICAgICAgIHJldHVybiByZWdleDtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIG5hdGl2ZSBgUmVnRXhwYCBmbGFncyB1c2VkIGJ5IGEgcmVnZXggb2JqZWN0LlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gY2hlY2suXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IE5hdGl2ZSBmbGFncyBpbiB1c2UuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gZ2V0TmF0aXZlRmxhZ3MocmVnZXgpIHtcclxuICAgICAgICAvL3JldHVybiBuYXRpdi5leGVjLmNhbGwoL1xcLyhbYS16XSopJC9pLCBTdHJpbmcocmVnZXgpKVsxXTtcclxuICAgICAgICByZXR1cm4gKHJlZ2V4Lmdsb2JhbCAgICAgPyBcImdcIiA6IFwiXCIpICtcclxuICAgICAgICAgICAgICAgKHJlZ2V4Lmlnbm9yZUNhc2UgPyBcImlcIiA6IFwiXCIpICtcclxuICAgICAgICAgICAgICAgKHJlZ2V4Lm11bHRpbGluZSAgPyBcIm1cIiA6IFwiXCIpICtcclxuICAgICAgICAgICAgICAgKHJlZ2V4LmV4dGVuZGVkICAgPyBcInhcIiA6IFwiXCIpICsgLy8gUHJvcG9zZWQgZm9yIEVTNiwgaW5jbHVkZWQgaW4gQVMzXHJcbiAgICAgICAgICAgICAgIChyZWdleC5zdGlja3kgICAgID8gXCJ5XCIgOiBcIlwiKTsgLy8gUHJvcG9zZWQgZm9yIEVTNiwgaW5jbHVkZWQgaW4gRmlyZWZveCAzK1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIENvcGllcyBhIHJlZ2V4IG9iamVjdCB3aGlsZSBwcmVzZXJ2aW5nIHNwZWNpYWwgcHJvcGVydGllcyBmb3IgbmFtZWQgY2FwdHVyZSBhbmQgYXVnbWVudGluZyB3aXRoXHJcbiAqIGBYUmVnRXhwLnByb3RvdHlwZWAgbWV0aG9kcy4gVGhlIGNvcHkgaGFzIGEgZnJlc2ggYGxhc3RJbmRleGAgcHJvcGVydHkgKHNldCB0byB6ZXJvKS4gQWxsb3dzXHJcbiAqIGFkZGluZyBhbmQgcmVtb3ZpbmcgZmxhZ3Mgd2hpbGUgY29weWluZyB0aGUgcmVnZXguXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdleCBSZWdleCB0byBjb3B5LlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2FkZEZsYWdzXSBGbGFncyB0byBiZSBhZGRlZCB3aGlsZSBjb3B5aW5nIHRoZSByZWdleC5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtyZW1vdmVGbGFnc10gRmxhZ3MgdG8gYmUgcmVtb3ZlZCB3aGlsZSBjb3B5aW5nIHRoZSByZWdleC5cclxuICogQHJldHVybnMge1JlZ0V4cH0gQ29weSBvZiB0aGUgcHJvdmlkZWQgcmVnZXgsIHBvc3NpYmx5IHdpdGggbW9kaWZpZWQgZmxhZ3MuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gY29weShyZWdleCwgYWRkRmxhZ3MsIHJlbW92ZUZsYWdzKSB7XHJcbiAgICAgICAgaWYgKCFzZWxmLmlzUmVnRXhwKHJlZ2V4KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwidHlwZSBSZWdFeHAgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBmbGFncyA9IG5hdGl2LnJlcGxhY2UuY2FsbChnZXROYXRpdmVGbGFncyhyZWdleCkgKyAoYWRkRmxhZ3MgfHwgXCJcIiksIGR1cGxpY2F0ZUZsYWdzLCBcIlwiKTtcclxuICAgICAgICBpZiAocmVtb3ZlRmxhZ3MpIHtcclxuICAgICAgICAgICAgLy8gV291bGQgbmVlZCB0byBlc2NhcGUgYHJlbW92ZUZsYWdzYCBpZiB0aGlzIHdhcyBwdWJsaWNcclxuICAgICAgICAgICAgZmxhZ3MgPSBuYXRpdi5yZXBsYWNlLmNhbGwoZmxhZ3MsIG5ldyBSZWdFeHAoXCJbXCIgKyByZW1vdmVGbGFncyArIFwiXStcIiwgXCJnXCIpLCBcIlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlZ2V4LnhyZWdleHAgJiYgIXJlZ2V4LnhyZWdleHAuaXNOYXRpdmUpIHtcclxuICAgICAgICAgICAgLy8gQ29tcGlsaW5nIHRoZSBjdXJyZW50IChyYXRoZXIgdGhhbiBwcmVjb21waWxhdGlvbikgc291cmNlIHByZXNlcnZlcyB0aGUgZWZmZWN0cyBvZiBub25uYXRpdmUgc291cmNlIGZsYWdzXHJcbiAgICAgICAgICAgIHJlZ2V4ID0gYXVnbWVudChzZWxmKHJlZ2V4LnNvdXJjZSwgZmxhZ3MpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVnZXgueHJlZ2V4cC5jYXB0dXJlTmFtZXMgPyByZWdleC54cmVnZXhwLmNhcHR1cmVOYW1lcy5zbGljZSgwKSA6IG51bGwpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEF1Z21lbnQgd2l0aCBgWFJlZ0V4cC5wcm90b3R5cGVgIG1ldGhvZHMsIGJ1dCB1c2UgbmF0aXZlIGBSZWdFeHBgIChhdm9pZCBzZWFyY2hpbmcgZm9yIHNwZWNpYWwgdG9rZW5zKVxyXG4gICAgICAgICAgICByZWdleCA9IGF1Z21lbnQobmV3IFJlZ0V4cChyZWdleC5zb3VyY2UsIGZsYWdzKSwgbnVsbCwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZWdleDtcclxuICAgIH1cclxuXHJcbi8qXHJcbiAqIFJldHVybnMgdGhlIGxhc3QgaW5kZXggYXQgd2hpY2ggYSBnaXZlbiB2YWx1ZSBjYW4gYmUgZm91bmQgaW4gYW4gYXJyYXksIG9yIGAtMWAgaWYgaXQncyBub3RcclxuICogcHJlc2VudC4gVGhlIGFycmF5IGlzIHNlYXJjaGVkIGJhY2t3YXJkcy5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgQXJyYXkgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0geyp9IHZhbHVlIFZhbHVlIHRvIGxvY2F0ZSBpbiB0aGUgYXJyYXkuXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IExhc3QgemVyby1iYXNlZCBpbmRleCBhdCB3aGljaCB0aGUgaXRlbSBpcyBmb3VuZCwgb3IgLTEuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gbGFzdEluZGV4T2YoYXJyYXksIHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIGkgPSBhcnJheS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZikge1xyXG4gICAgICAgICAgICByZXR1cm4gYXJyYXkubGFzdEluZGV4T2YodmFsdWUpOyAvLyBVc2UgdGhlIG5hdGl2ZSBtZXRob2QgaWYgYXZhaWxhYmxlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgaWYgKGFycmF5W2ldID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIERldGVybWluZXMgd2hldGhlciBhbiBvYmplY3QgaXMgb2YgdGhlIHNwZWNpZmllZCB0eXBlLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0geyp9IHZhbHVlIE9iamVjdCB0byBjaGVjay5cclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVHlwZSB0byBjaGVjayBmb3IsIGluIGxvd2VyY2FzZS5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgdGhlIG9iamVjdCBtYXRjaGVzIHRoZSB0eXBlLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGlzVHlwZSh2YWx1ZSwgdHlwZSkge1xyXG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLnRvTG93ZXJDYXNlKCkgPT09IFwiW29iamVjdCBcIiArIHR5cGUgKyBcIl1cIjtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBQcmVwYXJlcyBhbiBvcHRpb25zIG9iamVjdCBmcm9tIHRoZSBnaXZlbiB2YWx1ZS5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSB2YWx1ZSBWYWx1ZSB0byBjb252ZXJ0IHRvIGFuIG9wdGlvbnMgb2JqZWN0LlxyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBPcHRpb25zIG9iamVjdC5cclxuICovXHJcbiAgICBmdW5jdGlvbiBwcmVwYXJlT3B0aW9ucyh2YWx1ZSkge1xyXG4gICAgICAgIHZhbHVlID0gdmFsdWUgfHwge307XHJcbiAgICAgICAgaWYgKHZhbHVlID09PSBcImFsbFwiIHx8IHZhbHVlLmFsbCkge1xyXG4gICAgICAgICAgICB2YWx1ZSA9IHtuYXRpdmVzOiB0cnVlLCBleHRlbnNpYmlsaXR5OiB0cnVlfTtcclxuICAgICAgICB9IGVsc2UgaWYgKGlzVHlwZSh2YWx1ZSwgXCJzdHJpbmdcIikpIHtcclxuICAgICAgICAgICAgdmFsdWUgPSBzZWxmLmZvckVhY2godmFsdWUsIC9bXlxccyxdKy8sIGZ1bmN0aW9uIChtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzW21dID0gdHJ1ZTtcclxuICAgICAgICAgICAgfSwge30pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogUnVucyBidWlsdC1pbi9jdXN0b20gdG9rZW5zIGluIHJldmVyc2UgaW5zZXJ0aW9uIG9yZGVyLCB1bnRpbCBhIG1hdGNoIGlzIGZvdW5kLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0dGVybiBPcmlnaW5hbCBwYXR0ZXJuIGZyb20gd2hpY2ggYW4gWFJlZ0V4cCBvYmplY3QgaXMgYmVpbmcgYnVpbHQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBwb3MgUG9zaXRpb24gdG8gc2VhcmNoIGZvciB0b2tlbnMgd2l0aGluIGBwYXR0ZXJuYC5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHNjb3BlIEN1cnJlbnQgcmVnZXggc2NvcGUuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IENvbnRleHQgb2JqZWN0IGFzc2lnbmVkIHRvIHRva2VuIGhhbmRsZXIgZnVuY3Rpb25zLlxyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBPYmplY3Qgd2l0aCBwcm9wZXJ0aWVzIGBvdXRwdXRgICh0aGUgc3Vic3RpdHV0aW9uIHN0cmluZyByZXR1cm5lZCBieSB0aGVcclxuICogICBzdWNjZXNzZnVsIHRva2VuIGhhbmRsZXIpIGFuZCBgbWF0Y2hgICh0aGUgdG9rZW4ncyBtYXRjaCBhcnJheSksIG9yIG51bGwuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gcnVuVG9rZW5zKHBhdHRlcm4sIHBvcywgc2NvcGUsIGNvbnRleHQpIHtcclxuICAgICAgICB2YXIgaSA9IHRva2Vucy5sZW5ndGgsXHJcbiAgICAgICAgICAgIHJlc3VsdCA9IG51bGwsXHJcbiAgICAgICAgICAgIG1hdGNoLFxyXG4gICAgICAgICAgICB0O1xyXG4gICAgICAgIC8vIFByb3RlY3QgYWdhaW5zdCBjb25zdHJ1Y3RpbmcgWFJlZ0V4cHMgd2l0aGluIHRva2VuIGhhbmRsZXIgYW5kIHRyaWdnZXIgZnVuY3Rpb25zXHJcbiAgICAgICAgaXNJbnNpZGVDb25zdHJ1Y3RvciA9IHRydWU7XHJcbiAgICAgICAgLy8gTXVzdCByZXNldCBgaXNJbnNpZGVDb25zdHJ1Y3RvcmAsIGV2ZW4gaWYgYSBgdHJpZ2dlcmAgb3IgYGhhbmRsZXJgIHRocm93c1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHsgLy8gUnVuIGluIHJldmVyc2Ugb3JkZXJcclxuICAgICAgICAgICAgICAgIHQgPSB0b2tlbnNbaV07XHJcbiAgICAgICAgICAgICAgICBpZiAoKHQuc2NvcGUgPT09IFwiYWxsXCIgfHwgdC5zY29wZSA9PT0gc2NvcGUpICYmICghdC50cmlnZ2VyIHx8IHQudHJpZ2dlci5jYWxsKGNvbnRleHQpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHQucGF0dGVybi5sYXN0SW5kZXggPSBwb3M7XHJcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBmaXhlZC5leGVjLmNhbGwodC5wYXR0ZXJuLCBwYXR0ZXJuKTsgLy8gRml4ZWQgYGV4ZWNgIGhlcmUgYWxsb3dzIHVzZSBvZiBuYW1lZCBiYWNrcmVmZXJlbmNlcywgZXRjLlxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaC5pbmRleCA9PT0gcG9zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dDogdC5oYW5kbGVyLmNhbGwoY29udGV4dCwgbWF0Y2gsIHNjb3BlKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoOiBtYXRjaFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIGlzSW5zaWRlQ29uc3RydWN0b3IgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBFbmFibGVzIG9yIGRpc2FibGVzIFhSZWdFeHAgc3ludGF4IGFuZCBmbGFnIGV4dGVuc2liaWxpdHkuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb24gYHRydWVgIHRvIGVuYWJsZTsgYGZhbHNlYCB0byBkaXNhYmxlLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIHNldEV4dGVuc2liaWxpdHkob24pIHtcclxuICAgICAgICBzZWxmLmFkZFRva2VuID0gYWRkVG9rZW5bb24gPyBcIm9uXCIgOiBcIm9mZlwiXTtcclxuICAgICAgICBmZWF0dXJlcy5leHRlbnNpYmlsaXR5ID0gb247XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogRW5hYmxlcyBvciBkaXNhYmxlcyBuYXRpdmUgbWV0aG9kIG92ZXJyaWRlcy5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtCb29sZWFufSBvbiBgdHJ1ZWAgdG8gZW5hYmxlOyBgZmFsc2VgIHRvIGRpc2FibGUuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gc2V0TmF0aXZlcyhvbikge1xyXG4gICAgICAgIFJlZ0V4cC5wcm90b3R5cGUuZXhlYyA9IChvbiA/IGZpeGVkIDogbmF0aXYpLmV4ZWM7XHJcbiAgICAgICAgUmVnRXhwLnByb3RvdHlwZS50ZXN0ID0gKG9uID8gZml4ZWQgOiBuYXRpdikudGVzdDtcclxuICAgICAgICBTdHJpbmcucHJvdG90eXBlLm1hdGNoID0gKG9uID8gZml4ZWQgOiBuYXRpdikubWF0Y2g7XHJcbiAgICAgICAgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlID0gKG9uID8gZml4ZWQgOiBuYXRpdikucmVwbGFjZTtcclxuICAgICAgICBTdHJpbmcucHJvdG90eXBlLnNwbGl0ID0gKG9uID8gZml4ZWQgOiBuYXRpdikuc3BsaXQ7XHJcbiAgICAgICAgZmVhdHVyZXMubmF0aXZlcyA9IG9uO1xyXG4gICAgfVxyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29uc3RydWN0b3JcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYW4gZXh0ZW5kZWQgcmVndWxhciBleHByZXNzaW9uIG9iamVjdCBmb3IgbWF0Y2hpbmcgdGV4dCB3aXRoIGEgcGF0dGVybi4gRGlmZmVycyBmcm9tIGFcclxuICogbmF0aXZlIHJlZ3VsYXIgZXhwcmVzc2lvbiBpbiB0aGF0IGFkZGl0aW9uYWwgc3ludGF4IGFuZCBmbGFncyBhcmUgc3VwcG9ydGVkLiBUaGUgcmV0dXJuZWQgb2JqZWN0XHJcbiAqIGlzIGluIGZhY3QgYSBuYXRpdmUgYFJlZ0V4cGAgYW5kIHdvcmtzIHdpdGggYWxsIG5hdGl2ZSBtZXRob2RzLlxyXG4gKiBAY2xhc3MgWFJlZ0V4cFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBwYXR0ZXJuIFJlZ2V4IHBhdHRlcm4gc3RyaW5nLCBvciBhbiBleGlzdGluZyBgUmVnRXhwYCBvYmplY3QgdG8gY29weS5cclxuICogQHBhcmFtIHtTdHJpbmd9IFtmbGFnc10gQW55IGNvbWJpbmF0aW9uIG9mIGZsYWdzOlxyXG4gKiAgIDxsaT5gZ2AgLSBnbG9iYWxcclxuICogICA8bGk+YGlgIC0gaWdub3JlIGNhc2VcclxuICogICA8bGk+YG1gIC0gbXVsdGlsaW5lIGFuY2hvcnNcclxuICogICA8bGk+YG5gIC0gZXhwbGljaXQgY2FwdHVyZVxyXG4gKiAgIDxsaT5gc2AgLSBkb3QgbWF0Y2hlcyBhbGwgKGFrYSBzaW5nbGVsaW5lKVxyXG4gKiAgIDxsaT5geGAgLSBmcmVlLXNwYWNpbmcgYW5kIGxpbmUgY29tbWVudHMgKGFrYSBleHRlbmRlZClcclxuICogICA8bGk+YHlgIC0gc3RpY2t5IChGaXJlZm94IDMrIG9ubHkpXHJcbiAqICAgRmxhZ3MgY2Fubm90IGJlIHByb3ZpZGVkIHdoZW4gY29uc3RydWN0aW5nIG9uZSBgUmVnRXhwYCBmcm9tIGFub3RoZXIuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IEV4dGVuZGVkIHJlZ3VsYXIgZXhwcmVzc2lvbiBvYmplY3QuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIFdpdGggbmFtZWQgY2FwdHVyZSBhbmQgZmxhZyB4XHJcbiAqIGRhdGUgPSBYUmVnRXhwKCcoPzx5ZWFyPiAgWzAtOV17NH0pIC0/ICAjIHllYXIgIFxcblxcXHJcbiAqICAgICAgICAgICAgICAgICAoPzxtb250aD4gWzAtOV17Mn0pIC0/ICAjIG1vbnRoIFxcblxcXHJcbiAqICAgICAgICAgICAgICAgICAoPzxkYXk+ICAgWzAtOV17Mn0pICAgICAjIGRheSAgICcsICd4Jyk7XHJcbiAqXHJcbiAqIC8vIFBhc3NpbmcgYSByZWdleCBvYmplY3QgdG8gY29weSBpdC4gVGhlIGNvcHkgbWFpbnRhaW5zIHNwZWNpYWwgcHJvcGVydGllcyBmb3IgbmFtZWQgY2FwdHVyZSxcclxuICogLy8gaXMgYXVnbWVudGVkIHdpdGggYFhSZWdFeHAucHJvdG90eXBlYCBtZXRob2RzLCBhbmQgaGFzIGEgZnJlc2ggYGxhc3RJbmRleGAgcHJvcGVydHkgKHNldCB0b1xyXG4gKiAvLyB6ZXJvKS4gTmF0aXZlIHJlZ2V4ZXMgYXJlIG5vdCByZWNvbXBpbGVkIHVzaW5nIFhSZWdFeHAgc3ludGF4LlxyXG4gKiBYUmVnRXhwKC9yZWdleC8pO1xyXG4gKi9cclxuICAgIHNlbGYgPSBmdW5jdGlvbiAocGF0dGVybiwgZmxhZ3MpIHtcclxuICAgICAgICBpZiAoc2VsZi5pc1JlZ0V4cChwYXR0ZXJuKSkge1xyXG4gICAgICAgICAgICBpZiAoZmxhZ3MgIT09IHVuZGVmKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FuJ3Qgc3VwcGx5IGZsYWdzIHdoZW4gY29uc3RydWN0aW5nIG9uZSBSZWdFeHAgZnJvbSBhbm90aGVyXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBjb3B5KHBhdHRlcm4pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBUb2tlbnMgYmVjb21lIHBhcnQgb2YgdGhlIHJlZ2V4IGNvbnN0cnVjdGlvbiBwcm9jZXNzLCBzbyBwcm90ZWN0IGFnYWluc3QgaW5maW5pdGUgcmVjdXJzaW9uXHJcbiAgICAgICAgLy8gd2hlbiBhbiBYUmVnRXhwIGlzIGNvbnN0cnVjdGVkIHdpdGhpbiBhIHRva2VuIGhhbmRsZXIgZnVuY3Rpb25cclxuICAgICAgICBpZiAoaXNJbnNpZGVDb25zdHJ1Y3Rvcikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW4ndCBjYWxsIHRoZSBYUmVnRXhwIGNvbnN0cnVjdG9yIHdpdGhpbiB0b2tlbiBkZWZpbml0aW9uIGZ1bmN0aW9uc1wiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBvdXRwdXQgPSBbXSxcclxuICAgICAgICAgICAgc2NvcGUgPSBkZWZhdWx0U2NvcGUsXHJcbiAgICAgICAgICAgIHRva2VuQ29udGV4dCA9IHtcclxuICAgICAgICAgICAgICAgIGhhc05hbWVkQ2FwdHVyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBjYXB0dXJlTmFtZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgaGFzRmxhZzogZnVuY3Rpb24gKGZsYWcpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmxhZ3MuaW5kZXhPZihmbGFnKSA+IC0xO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwb3MgPSAwLFxyXG4gICAgICAgICAgICB0b2tlblJlc3VsdCxcclxuICAgICAgICAgICAgbWF0Y2gsXHJcbiAgICAgICAgICAgIGNocjtcclxuICAgICAgICBwYXR0ZXJuID0gcGF0dGVybiA9PT0gdW5kZWYgPyBcIlwiIDogU3RyaW5nKHBhdHRlcm4pO1xyXG4gICAgICAgIGZsYWdzID0gZmxhZ3MgPT09IHVuZGVmID8gXCJcIiA6IFN0cmluZyhmbGFncyk7XHJcblxyXG4gICAgICAgIGlmIChuYXRpdi5tYXRjaC5jYWxsKGZsYWdzLCBkdXBsaWNhdGVGbGFncykpIHsgLy8gRG9uJ3QgdXNlIHRlc3QvZXhlYyBiZWNhdXNlIHRoZXkgd291bGQgdXBkYXRlIGxhc3RJbmRleFxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJpbnZhbGlkIGR1cGxpY2F0ZSByZWd1bGFyIGV4cHJlc3Npb24gZmxhZ1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gU3RyaXAvYXBwbHkgbGVhZGluZyBtb2RlIG1vZGlmaWVyIHdpdGggYW55IGNvbWJpbmF0aW9uIG9mIGZsYWdzIGV4Y2VwdCBnIG9yIHk6ICg/aW1uc3gpXHJcbiAgICAgICAgcGF0dGVybiA9IG5hdGl2LnJlcGxhY2UuY2FsbChwYXR0ZXJuLCAvXlxcKFxcPyhbXFx3JF0rKVxcKS8sIGZ1bmN0aW9uICgkMCwgJDEpIHtcclxuICAgICAgICAgICAgaWYgKG5hdGl2LnRlc3QuY2FsbCgvW2d5XS8sICQxKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiY2FuJ3QgdXNlIGZsYWcgZyBvciB5IGluIG1vZGUgbW9kaWZpZXJcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZmxhZ3MgPSBuYXRpdi5yZXBsYWNlLmNhbGwoZmxhZ3MgKyAkMSwgZHVwbGljYXRlRmxhZ3MsIFwiXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICB9KTtcclxuICAgICAgICBzZWxmLmZvckVhY2goZmxhZ3MsIC9bXFxzXFxTXS8sIGZ1bmN0aW9uIChtKSB7XHJcbiAgICAgICAgICAgIGlmIChyZWdpc3RlcmVkRmxhZ3MuaW5kZXhPZihtWzBdKSA8IDApIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImludmFsaWQgcmVndWxhciBleHByZXNzaW9uIGZsYWcgXCIgKyBtWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB3aGlsZSAocG9zIDwgcGF0dGVybi5sZW5ndGgpIHtcclxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGN1c3RvbSB0b2tlbnMgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgdG9rZW5SZXN1bHQgPSBydW5Ub2tlbnMocGF0dGVybiwgcG9zLCBzY29wZSwgdG9rZW5Db250ZXh0KTtcclxuICAgICAgICAgICAgaWYgKHRva2VuUmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaCh0b2tlblJlc3VsdC5vdXRwdXQpO1xyXG4gICAgICAgICAgICAgICAgcG9zICs9ICh0b2tlblJlc3VsdC5tYXRjaFswXS5sZW5ndGggfHwgMSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgbmF0aXZlIHRva2VucyAoZXhjZXB0IGNoYXJhY3RlciBjbGFzc2VzKSBhdCB0aGUgY3VycmVudCBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgbWF0Y2ggPSBuYXRpdi5leGVjLmNhbGwobmF0aXZlVG9rZW5zW3Njb3BlXSwgcGF0dGVybi5zbGljZShwb3MpKTtcclxuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKG1hdGNoWzBdKTtcclxuICAgICAgICAgICAgICAgICAgICBwb3MgKz0gbWF0Y2hbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBjaHIgPSBwYXR0ZXJuLmNoYXJBdChwb3MpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaHIgPT09IFwiW1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlID0gY2xhc3NTY29wZTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gXCJdXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUgPSBkZWZhdWx0U2NvcGU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkdmFuY2UgcG9zaXRpb24gYnkgb25lIGNoYXJhY3RlclxyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKGNocik7XHJcbiAgICAgICAgICAgICAgICAgICAgKytwb3M7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBhdWdtZW50KG5ldyBSZWdFeHAob3V0cHV0LmpvaW4oXCJcIiksIG5hdGl2LnJlcGxhY2UuY2FsbChmbGFncywgL1teZ2lteV0rL2csIFwiXCIpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICB0b2tlbkNvbnRleHQuaGFzTmFtZWRDYXB0dXJlID8gdG9rZW5Db250ZXh0LmNhcHR1cmVOYW1lcyA6IG51bGwpO1xyXG4gICAgfTtcclxuXHJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIFB1YmxpYyBtZXRob2RzL3Byb3BlcnRpZXNcclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuLy8gSW5zdGFsbGVkIGFuZCB1bmluc3RhbGxlZCBzdGF0ZXMgZm9yIGBYUmVnRXhwLmFkZFRva2VuYFxyXG4gICAgYWRkVG9rZW4gPSB7XHJcbiAgICAgICAgb246IGZ1bmN0aW9uIChyZWdleCwgaGFuZGxlciwgb3B0aW9ucykge1xyXG4gICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgICAgICAgICAgaWYgKHJlZ2V4KSB7XHJcbiAgICAgICAgICAgICAgICB0b2tlbnMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogY29weShyZWdleCwgXCJnXCIgKyAoaGFzTmF0aXZlWSA/IFwieVwiIDogXCJcIikpLFxyXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgc2NvcGU6IG9wdGlvbnMuc2NvcGUgfHwgZGVmYXVsdFNjb3BlLFxyXG4gICAgICAgICAgICAgICAgICAgIHRyaWdnZXI6IG9wdGlvbnMudHJpZ2dlciB8fCBudWxsXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBQcm92aWRpbmcgYGN1c3RvbUZsYWdzYCB3aXRoIG51bGwgYHJlZ2V4YCBhbmQgYGhhbmRsZXJgIGFsbG93cyBhZGRpbmcgZmxhZ3MgdGhhdCBkb1xyXG4gICAgICAgICAgICAvLyBub3RoaW5nLCBidXQgZG9uJ3QgdGhyb3cgYW4gZXJyb3JcclxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY3VzdG9tRmxhZ3MpIHtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRGbGFncyA9IG5hdGl2LnJlcGxhY2UuY2FsbChyZWdpc3RlcmVkRmxhZ3MgKyBvcHRpb25zLmN1c3RvbUZsYWdzLCBkdXBsaWNhdGVGbGFncywgXCJcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIG9mZjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleHRlbnNpYmlsaXR5IG11c3QgYmUgaW5zdGFsbGVkIGJlZm9yZSB1c2luZyBhZGRUb2tlblwiKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEV4dGVuZHMgb3IgY2hhbmdlcyBYUmVnRXhwIHN5bnRheCBhbmQgYWxsb3dzIGN1c3RvbSBmbGFncy4gVGhpcyBpcyB1c2VkIGludGVybmFsbHkgYW5kIGNhbiBiZVxyXG4gKiB1c2VkIHRvIGNyZWF0ZSBYUmVnRXhwIGFkZG9ucy4gYFhSZWdFeHAuaW5zdGFsbCgnZXh0ZW5zaWJpbGl0eScpYCBtdXN0IGJlIHJ1biBiZWZvcmUgY2FsbGluZ1xyXG4gKiB0aGlzIGZ1bmN0aW9uLCBvciBhbiBlcnJvciBpcyB0aHJvd24uIElmIG1vcmUgdGhhbiBvbmUgdG9rZW4gY2FuIG1hdGNoIHRoZSBzYW1lIHN0cmluZywgdGhlIGxhc3RcclxuICogYWRkZWQgd2lucy5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4IFJlZ2V4IG9iamVjdCB0aGF0IG1hdGNoZXMgdGhlIG5ldyB0b2tlbi5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlciBGdW5jdGlvbiB0aGF0IHJldHVybnMgYSBuZXcgcGF0dGVybiBzdHJpbmcgKHVzaW5nIG5hdGl2ZSByZWdleCBzeW50YXgpXHJcbiAqICAgdG8gcmVwbGFjZSB0aGUgbWF0Y2hlZCB0b2tlbiB3aXRoaW4gYWxsIGZ1dHVyZSBYUmVnRXhwIHJlZ2V4ZXMuIEhhcyBhY2Nlc3MgdG8gcGVyc2lzdGVudFxyXG4gKiAgIHByb3BlcnRpZXMgb2YgdGhlIHJlZ2V4IGJlaW5nIGJ1aWx0LCB0aHJvdWdoIGB0aGlzYC4gSW52b2tlZCB3aXRoIHR3byBhcmd1bWVudHM6XHJcbiAqICAgPGxpPlRoZSBtYXRjaCBhcnJheSwgd2l0aCBuYW1lZCBiYWNrcmVmZXJlbmNlIHByb3BlcnRpZXMuXHJcbiAqICAgPGxpPlRoZSByZWdleCBzY29wZSB3aGVyZSB0aGUgbWF0Y2ggd2FzIGZvdW5kLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIE9wdGlvbnMgb2JqZWN0IHdpdGggb3B0aW9uYWwgcHJvcGVydGllczpcclxuICogICA8bGk+YHNjb3BlYCB7U3RyaW5nfSBTY29wZXMgd2hlcmUgdGhlIHRva2VuIGFwcGxpZXM6ICdkZWZhdWx0JywgJ2NsYXNzJywgb3IgJ2FsbCcuXHJcbiAqICAgPGxpPmB0cmlnZ2VyYCB7RnVuY3Rpb259IEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBgdHJ1ZWAgd2hlbiB0aGUgdG9rZW4gc2hvdWxkIGJlIGFwcGxpZWQ7IGUuZy4sXHJcbiAqICAgICBpZiBhIGZsYWcgaXMgc2V0LiBJZiBgZmFsc2VgIGlzIHJldHVybmVkLCB0aGUgbWF0Y2hlZCBzdHJpbmcgY2FuIGJlIG1hdGNoZWQgYnkgb3RoZXIgdG9rZW5zLlxyXG4gKiAgICAgSGFzIGFjY2VzcyB0byBwZXJzaXN0ZW50IHByb3BlcnRpZXMgb2YgdGhlIHJlZ2V4IGJlaW5nIGJ1aWx0LCB0aHJvdWdoIGB0aGlzYCAoaW5jbHVkaW5nXHJcbiAqICAgICBmdW5jdGlvbiBgdGhpcy5oYXNGbGFnYCkuXHJcbiAqICAgPGxpPmBjdXN0b21GbGFnc2Age1N0cmluZ30gTm9ubmF0aXZlIGZsYWdzIHVzZWQgYnkgdGhlIHRva2VuJ3MgaGFuZGxlciBvciB0cmlnZ2VyIGZ1bmN0aW9ucy5cclxuICogICAgIFByZXZlbnRzIFhSZWdFeHAgZnJvbSB0aHJvd2luZyBhbiBpbnZhbGlkIGZsYWcgZXJyb3Igd2hlbiB0aGUgc3BlY2lmaWVkIGZsYWdzIGFyZSB1c2VkLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBCYXNpYyB1c2FnZTogQWRkcyBcXGEgZm9yIEFMRVJUIGNoYXJhY3RlclxyXG4gKiBYUmVnRXhwLmFkZFRva2VuKFxyXG4gKiAgIC9cXFxcYS8sXHJcbiAqICAgZnVuY3Rpb24gKCkge3JldHVybiAnXFxcXHgwNyc7fSxcclxuICogICB7c2NvcGU6ICdhbGwnfVxyXG4gKiApO1xyXG4gKiBYUmVnRXhwKCdcXFxcYVtcXFxcYS1cXFxcbl0rJykudGVzdCgnXFx4MDdcXG5cXHgwNycpOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgc2VsZi5hZGRUb2tlbiA9IGFkZFRva2VuLm9mZjtcclxuXHJcbi8qKlxyXG4gKiBDYWNoZXMgYW5kIHJldHVybnMgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIGBYUmVnRXhwKHBhdHRlcm4sIGZsYWdzKWAuIE9uIGFueSBzdWJzZXF1ZW50IGNhbGwgd2l0aFxyXG4gKiB0aGUgc2FtZSBwYXR0ZXJuIGFuZCBmbGFnIGNvbWJpbmF0aW9uLCB0aGUgY2FjaGVkIGNvcHkgaXMgcmV0dXJuZWQuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXR0ZXJuIFJlZ2V4IHBhdHRlcm4gc3RyaW5nLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2ZsYWdzXSBBbnkgY29tYmluYXRpb24gb2YgWFJlZ0V4cCBmbGFncy5cclxuICogQHJldHVybnMge1JlZ0V4cH0gQ2FjaGVkIFhSZWdFeHAgb2JqZWN0LlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiB3aGlsZSAobWF0Y2ggPSBYUmVnRXhwLmNhY2hlKCcuJywgJ2dzJykuZXhlYyhzdHIpKSB7XHJcbiAqICAgLy8gVGhlIHJlZ2V4IGlzIGNvbXBpbGVkIG9uY2Ugb25seVxyXG4gKiB9XHJcbiAqL1xyXG4gICAgc2VsZi5jYWNoZSA9IGZ1bmN0aW9uIChwYXR0ZXJuLCBmbGFncykge1xyXG4gICAgICAgIHZhciBrZXkgPSBwYXR0ZXJuICsgXCIvXCIgKyAoZmxhZ3MgfHwgXCJcIik7XHJcbiAgICAgICAgcmV0dXJuIGNhY2hlW2tleV0gfHwgKGNhY2hlW2tleV0gPSBzZWxmKHBhdHRlcm4sIGZsYWdzKSk7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEVzY2FwZXMgYW55IHJlZ3VsYXIgZXhwcmVzc2lvbiBtZXRhY2hhcmFjdGVycywgZm9yIHVzZSB3aGVuIG1hdGNoaW5nIGxpdGVyYWwgc3RyaW5ncy4gVGhlIHJlc3VsdFxyXG4gKiBjYW4gc2FmZWx5IGJlIHVzZWQgYXQgYW55IHBvaW50IHdpdGhpbiBhIHJlZ2V4IHRoYXQgdXNlcyBhbnkgZmxhZ3MuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIGVzY2FwZS5cclxuICogQHJldHVybnMge1N0cmluZ30gU3RyaW5nIHdpdGggcmVnZXggbWV0YWNoYXJhY3RlcnMgZXNjYXBlZC5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogWFJlZ0V4cC5lc2NhcGUoJ0VzY2FwZWQ/IDwuPicpO1xyXG4gKiAvLyAtPiAnRXNjYXBlZFxcP1xcIDxcXC4+J1xyXG4gKi9cclxuICAgIHNlbGYuZXNjYXBlID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIHJldHVybiBuYXRpdi5yZXBsYWNlLmNhbGwoc3RyLCAvWy1bXFxde30oKSorPy4sXFxcXF4kfCNcXHNdL2csIFwiXFxcXCQmXCIpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBFeGVjdXRlcyBhIHJlZ2V4IHNlYXJjaCBpbiBhIHNwZWNpZmllZCBzdHJpbmcuIFJldHVybnMgYSBtYXRjaCBhcnJheSBvciBgbnVsbGAuIElmIHRoZSBwcm92aWRlZFxyXG4gKiByZWdleCB1c2VzIG5hbWVkIGNhcHR1cmUsIG5hbWVkIGJhY2tyZWZlcmVuY2UgcHJvcGVydGllcyBhcmUgaW5jbHVkZWQgb24gdGhlIG1hdGNoIGFycmF5LlxyXG4gKiBPcHRpb25hbCBgcG9zYCBhbmQgYHN0aWNreWAgYXJndW1lbnRzIHNwZWNpZnkgdGhlIHNlYXJjaCBzdGFydCBwb3NpdGlvbiwgYW5kIHdoZXRoZXIgdGhlIG1hdGNoXHJcbiAqIG11c3Qgc3RhcnQgYXQgdGhlIHNwZWNpZmllZCBwb3NpdGlvbiBvbmx5LiBUaGUgYGxhc3RJbmRleGAgcHJvcGVydHkgb2YgdGhlIHByb3ZpZGVkIHJlZ2V4IGlzIG5vdFxyXG4gKiB1c2VkLCBidXQgaXMgdXBkYXRlZCBmb3IgY29tcGF0aWJpbGl0eS4gQWxzbyBmaXhlcyBicm93c2VyIGJ1Z3MgY29tcGFyZWQgdG8gdGhlIG5hdGl2ZVxyXG4gKiBgUmVnRXhwLnByb3RvdHlwZS5leGVjYCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHkgY3Jvc3MtYnJvd3Nlci5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gc2VhcmNoIHdpdGguXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zPTBdIFplcm8tYmFzZWQgaW5kZXggYXQgd2hpY2ggdG8gc3RhcnQgdGhlIHNlYXJjaC5cclxuICogQHBhcmFtIHtCb29sZWFufFN0cmluZ30gW3N0aWNreT1mYWxzZV0gV2hldGhlciB0aGUgbWF0Y2ggbXVzdCBzdGFydCBhdCB0aGUgc3BlY2lmaWVkIHBvc2l0aW9uXHJcbiAqICAgb25seS4gVGhlIHN0cmluZyBgJ3N0aWNreSdgIGlzIGFjY2VwdGVkIGFzIGFuIGFsdGVybmF0aXZlIHRvIGB0cnVlYC5cclxuICogQHJldHVybnMge0FycmF5fSBNYXRjaCBhcnJheSB3aXRoIG5hbWVkIGJhY2tyZWZlcmVuY2UgcHJvcGVydGllcywgb3IgbnVsbC5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gQmFzaWMgdXNlLCB3aXRoIG5hbWVkIGJhY2tyZWZlcmVuY2VcclxuICogdmFyIG1hdGNoID0gWFJlZ0V4cC5leGVjKCdVKzI2MjAnLCBYUmVnRXhwKCdVXFxcXCsoPzxoZXg+WzAtOUEtRl17NH0pJykpO1xyXG4gKiBtYXRjaC5oZXg7IC8vIC0+ICcyNjIwJ1xyXG4gKlxyXG4gKiAvLyBXaXRoIHBvcyBhbmQgc3RpY2t5LCBpbiBhIGxvb3BcclxuICogdmFyIHBvcyA9IDIsIHJlc3VsdCA9IFtdLCBtYXRjaDtcclxuICogd2hpbGUgKG1hdGNoID0gWFJlZ0V4cC5leGVjKCc8MT48Mj48Mz48ND41PDY+JywgLzwoXFxkKT4vLCBwb3MsICdzdGlja3knKSkge1xyXG4gKiAgIHJlc3VsdC5wdXNoKG1hdGNoWzFdKTtcclxuICogICBwb3MgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcclxuICogfVxyXG4gKiAvLyByZXN1bHQgLT4gWycyJywgJzMnLCAnNCddXHJcbiAqL1xyXG4gICAgc2VsZi5leGVjID0gZnVuY3Rpb24gKHN0ciwgcmVnZXgsIHBvcywgc3RpY2t5KSB7XHJcbiAgICAgICAgdmFyIHIyID0gY29weShyZWdleCwgXCJnXCIgKyAoc3RpY2t5ICYmIGhhc05hdGl2ZVkgPyBcInlcIiA6IFwiXCIpLCAoc3RpY2t5ID09PSBmYWxzZSA/IFwieVwiIDogXCJcIikpLFxyXG4gICAgICAgICAgICBtYXRjaDtcclxuICAgICAgICByMi5sYXN0SW5kZXggPSBwb3MgPSBwb3MgfHwgMDtcclxuICAgICAgICBtYXRjaCA9IGZpeGVkLmV4ZWMuY2FsbChyMiwgc3RyKTsgLy8gRml4ZWQgYGV4ZWNgIHJlcXVpcmVkIGZvciBgbGFzdEluZGV4YCBmaXgsIGV0Yy5cclxuICAgICAgICBpZiAoc3RpY2t5ICYmIG1hdGNoICYmIG1hdGNoLmluZGV4ICE9PSBwb3MpIHtcclxuICAgICAgICAgICAgbWF0Y2ggPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVnZXguZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgIHJlZ2V4Lmxhc3RJbmRleCA9IG1hdGNoID8gcjIubGFzdEluZGV4IDogMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBFeGVjdXRlcyBhIHByb3ZpZGVkIGZ1bmN0aW9uIG9uY2UgcGVyIHJlZ2V4IG1hdGNoLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzZWFyY2guXHJcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdleCBSZWdleCB0byBzZWFyY2ggd2l0aC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gZXhlY3V0ZSBmb3IgZWFjaCBtYXRjaC4gSW52b2tlZCB3aXRoIGZvdXIgYXJndW1lbnRzOlxyXG4gKiAgIDxsaT5UaGUgbWF0Y2ggYXJyYXksIHdpdGggbmFtZWQgYmFja3JlZmVyZW5jZSBwcm9wZXJ0aWVzLlxyXG4gKiAgIDxsaT5UaGUgemVyby1iYXNlZCBtYXRjaCBpbmRleC5cclxuICogICA8bGk+VGhlIHN0cmluZyBiZWluZyB0cmF2ZXJzZWQuXHJcbiAqICAgPGxpPlRoZSByZWdleCBvYmplY3QgYmVpbmcgdXNlZCB0byB0cmF2ZXJzZSB0aGUgc3RyaW5nLlxyXG4gKiBAcGFyYW0geyp9IFtjb250ZXh0XSBPYmplY3QgdG8gdXNlIGFzIGB0aGlzYCB3aGVuIGV4ZWN1dGluZyBgY2FsbGJhY2tgLlxyXG4gKiBAcmV0dXJucyB7Kn0gUHJvdmlkZWQgYGNvbnRleHRgIG9iamVjdC5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gRXh0cmFjdHMgZXZlcnkgb3RoZXIgZGlnaXQgZnJvbSBhIHN0cmluZ1xyXG4gKiBYUmVnRXhwLmZvckVhY2goJzFhMjM0NScsIC9cXGQvLCBmdW5jdGlvbiAobWF0Y2gsIGkpIHtcclxuICogICBpZiAoaSAlIDIpIHRoaXMucHVzaCgrbWF0Y2hbMF0pO1xyXG4gKiB9LCBbXSk7XHJcbiAqIC8vIC0+IFsyLCA0XVxyXG4gKi9cclxuICAgIHNlbGYuZm9yRWFjaCA9IGZ1bmN0aW9uIChzdHIsIHJlZ2V4LCBjYWxsYmFjaywgY29udGV4dCkge1xyXG4gICAgICAgIHZhciBwb3MgPSAwLFxyXG4gICAgICAgICAgICBpID0gLTEsXHJcbiAgICAgICAgICAgIG1hdGNoO1xyXG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSBzZWxmLmV4ZWMoc3RyLCByZWdleCwgcG9zKSkpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChjb250ZXh0LCBtYXRjaCwgKytpLCBzdHIsIHJlZ2V4KTtcclxuICAgICAgICAgICAgcG9zID0gbWF0Y2guaW5kZXggKyAobWF0Y2hbMF0ubGVuZ3RoIHx8IDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29udGV4dDtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogQ29waWVzIGEgcmVnZXggb2JqZWN0IGFuZCBhZGRzIGZsYWcgYGdgLiBUaGUgY29weSBtYWludGFpbnMgc3BlY2lhbCBwcm9wZXJ0aWVzIGZvciBuYW1lZFxyXG4gKiBjYXB0dXJlLCBpcyBhdWdtZW50ZWQgd2l0aCBgWFJlZ0V4cC5wcm90b3R5cGVgIG1ldGhvZHMsIGFuZCBoYXMgYSBmcmVzaCBgbGFzdEluZGV4YCBwcm9wZXJ0eVxyXG4gKiAoc2V0IHRvIHplcm8pLiBOYXRpdmUgcmVnZXhlcyBhcmUgbm90IHJlY29tcGlsZWQgdXNpbmcgWFJlZ0V4cCBzeW50YXguXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdleCBSZWdleCB0byBnbG9iYWxpemUuXHJcbiAqIEByZXR1cm5zIHtSZWdFeHB9IENvcHkgb2YgdGhlIHByb3ZpZGVkIHJlZ2V4IHdpdGggZmxhZyBgZ2AgYWRkZWQuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIHZhciBnbG9iYWxDb3B5ID0gWFJlZ0V4cC5nbG9iYWxpemUoL3JlZ2V4Lyk7XHJcbiAqIGdsb2JhbENvcHkuZ2xvYmFsOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgc2VsZi5nbG9iYWxpemUgPSBmdW5jdGlvbiAocmVnZXgpIHtcclxuICAgICAgICByZXR1cm4gY29weShyZWdleCwgXCJnXCIpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBJbnN0YWxscyBvcHRpb25hbCBmZWF0dXJlcyBhY2NvcmRpbmcgdG8gdGhlIHNwZWNpZmllZCBvcHRpb25zLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge09iamVjdHxTdHJpbmd9IG9wdGlvbnMgT3B0aW9ucyBvYmplY3Qgb3Igc3RyaW5nLlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAvLyBXaXRoIGFuIG9wdGlvbnMgb2JqZWN0XHJcbiAqIFhSZWdFeHAuaW5zdGFsbCh7XHJcbiAqICAgLy8gT3ZlcnJpZGVzIG5hdGl2ZSByZWdleCBtZXRob2RzIHdpdGggZml4ZWQvZXh0ZW5kZWQgdmVyc2lvbnMgdGhhdCBzdXBwb3J0IG5hbWVkXHJcbiAqICAgLy8gYmFja3JlZmVyZW5jZXMgYW5kIGZpeCBudW1lcm91cyBjcm9zcy1icm93c2VyIGJ1Z3NcclxuICogICBuYXRpdmVzOiB0cnVlLFxyXG4gKlxyXG4gKiAgIC8vIEVuYWJsZXMgZXh0ZW5zaWJpbGl0eSBvZiBYUmVnRXhwIHN5bnRheCBhbmQgZmxhZ3NcclxuICogICBleHRlbnNpYmlsaXR5OiB0cnVlXHJcbiAqIH0pO1xyXG4gKlxyXG4gKiAvLyBXaXRoIGFuIG9wdGlvbnMgc3RyaW5nXHJcbiAqIFhSZWdFeHAuaW5zdGFsbCgnbmF0aXZlcyBleHRlbnNpYmlsaXR5Jyk7XHJcbiAqXHJcbiAqIC8vIFVzaW5nIGEgc2hvcnRjdXQgdG8gaW5zdGFsbCBhbGwgb3B0aW9uYWwgZmVhdHVyZXNcclxuICogWFJlZ0V4cC5pbnN0YWxsKCdhbGwnKTtcclxuICovXHJcbiAgICBzZWxmLmluc3RhbGwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gICAgICAgIG9wdGlvbnMgPSBwcmVwYXJlT3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICBpZiAoIWZlYXR1cmVzLm5hdGl2ZXMgJiYgb3B0aW9ucy5uYXRpdmVzKSB7XHJcbiAgICAgICAgICAgIHNldE5hdGl2ZXModHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghZmVhdHVyZXMuZXh0ZW5zaWJpbGl0eSAmJiBvcHRpb25zLmV4dGVuc2liaWxpdHkpIHtcclxuICAgICAgICAgICAgc2V0RXh0ZW5zaWJpbGl0eSh0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrcyB3aGV0aGVyIGFuIGluZGl2aWR1YWwgb3B0aW9uYWwgZmVhdHVyZSBpcyBpbnN0YWxsZWQuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBmZWF0dXJlIE5hbWUgb2YgdGhlIGZlYXR1cmUgdG8gY2hlY2suIE9uZSBvZjpcclxuICogICA8bGk+YG5hdGl2ZXNgXHJcbiAqICAgPGxpPmBleHRlbnNpYmlsaXR5YFxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciB0aGUgZmVhdHVyZSBpcyBpbnN0YWxsZWQuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAuaXNJbnN0YWxsZWQoJ25hdGl2ZXMnKTtcclxuICovXHJcbiAgICBzZWxmLmlzSW5zdGFsbGVkID0gZnVuY3Rpb24gKGZlYXR1cmUpIHtcclxuICAgICAgICByZXR1cm4gISEoZmVhdHVyZXNbZmVhdHVyZV0pO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGB0cnVlYCBpZiBhbiBvYmplY3QgaXMgYSByZWdleDsgYGZhbHNlYCBpZiBpdCBpc24ndC4gVGhpcyB3b3JrcyBjb3JyZWN0bHkgZm9yIHJlZ2V4ZXNcclxuICogY3JlYXRlZCBpbiBhbm90aGVyIGZyYW1lLCB3aGVuIGBpbnN0YW5jZW9mYCBhbmQgYGNvbnN0cnVjdG9yYCBjaGVja3Mgd291bGQgZmFpbC5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHsqfSB2YWx1ZSBPYmplY3QgdG8gY2hlY2suXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSBvYmplY3QgaXMgYSBgUmVnRXhwYCBvYmplY3QuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAuaXNSZWdFeHAoJ3N0cmluZycpOyAvLyAtPiBmYWxzZVxyXG4gKiBYUmVnRXhwLmlzUmVnRXhwKC9yZWdleC9pKTsgLy8gLT4gdHJ1ZVxyXG4gKiBYUmVnRXhwLmlzUmVnRXhwKFJlZ0V4cCgnXicsICdtJykpOyAvLyAtPiB0cnVlXHJcbiAqIFhSZWdFeHAuaXNSZWdFeHAoWFJlZ0V4cCgnKD9zKS4nKSk7IC8vIC0+IHRydWVcclxuICovXHJcbiAgICBzZWxmLmlzUmVnRXhwID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIGlzVHlwZSh2YWx1ZSwgXCJyZWdleHBcIik7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFJldHJpZXZlcyB0aGUgbWF0Y2hlcyBmcm9tIHNlYXJjaGluZyBhIHN0cmluZyB1c2luZyBhIGNoYWluIG9mIHJlZ2V4ZXMgdGhhdCBzdWNjZXNzaXZlbHkgc2VhcmNoXHJcbiAqIHdpdGhpbiBwcmV2aW91cyBtYXRjaGVzLiBUaGUgcHJvdmlkZWQgYGNoYWluYCBhcnJheSBjYW4gY29udGFpbiByZWdleGVzIGFuZCBvYmplY3RzIHdpdGggYHJlZ2V4YFxyXG4gKiBhbmQgYGJhY2tyZWZgIHByb3BlcnRpZXMuIFdoZW4gYSBiYWNrcmVmZXJlbmNlIGlzIHNwZWNpZmllZCwgdGhlIG5hbWVkIG9yIG51bWJlcmVkIGJhY2tyZWZlcmVuY2VcclxuICogaXMgcGFzc2VkIGZvcndhcmQgdG8gdGhlIG5leHQgcmVnZXggb3IgcmV0dXJuZWQuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHtBcnJheX0gY2hhaW4gUmVnZXhlcyB0aGF0IGVhY2ggc2VhcmNoIGZvciBtYXRjaGVzIHdpdGhpbiBwcmVjZWRpbmcgcmVzdWx0cy5cclxuICogQHJldHVybnMge0FycmF5fSBNYXRjaGVzIGJ5IHRoZSBsYXN0IHJlZ2V4IGluIHRoZSBjaGFpbiwgb3IgYW4gZW1wdHkgYXJyYXkuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEJhc2ljIHVzYWdlOyBtYXRjaGVzIG51bWJlcnMgd2l0aGluIDxiPiB0YWdzXHJcbiAqIFhSZWdFeHAubWF0Y2hDaGFpbignMSA8Yj4yPC9iPiAzIDxiPjQgYSA1NjwvYj4nLCBbXHJcbiAqICAgWFJlZ0V4cCgnKD9pcyk8Yj4uKj88L2I+JyksXHJcbiAqICAgL1xcZCsvXHJcbiAqIF0pO1xyXG4gKiAvLyAtPiBbJzInLCAnNCcsICc1NiddXHJcbiAqXHJcbiAqIC8vIFBhc3NpbmcgZm9yd2FyZCBhbmQgcmV0dXJuaW5nIHNwZWNpZmljIGJhY2tyZWZlcmVuY2VzXHJcbiAqIGh0bWwgPSAnPGEgaHJlZj1cImh0dHA6Ly94cmVnZXhwLmNvbS9hcGkvXCI+WFJlZ0V4cDwvYT5cXFxyXG4gKiAgICAgICAgIDxhIGhyZWY9XCJodHRwOi8vd3d3Lmdvb2dsZS5jb20vXCI+R29vZ2xlPC9hPic7XHJcbiAqIFhSZWdFeHAubWF0Y2hDaGFpbihodG1sLCBbXHJcbiAqICAge3JlZ2V4OiAvPGEgaHJlZj1cIihbXlwiXSspXCI+L2ksIGJhY2tyZWY6IDF9LFxyXG4gKiAgIHtyZWdleDogWFJlZ0V4cCgnKD9pKV5odHRwcz86Ly8oPzxkb21haW4+W14vPyNdKyknKSwgYmFja3JlZjogJ2RvbWFpbid9XHJcbiAqIF0pO1xyXG4gKiAvLyAtPiBbJ3hyZWdleHAuY29tJywgJ3d3dy5nb29nbGUuY29tJ11cclxuICovXHJcbiAgICBzZWxmLm1hdGNoQ2hhaW4gPSBmdW5jdGlvbiAoc3RyLCBjaGFpbikge1xyXG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24gcmVjdXJzZUNoYWluKHZhbHVlcywgbGV2ZWwpIHtcclxuICAgICAgICAgICAgdmFyIGl0ZW0gPSBjaGFpbltsZXZlbF0ucmVnZXggPyBjaGFpbltsZXZlbF0gOiB7cmVnZXg6IGNoYWluW2xldmVsXX0sXHJcbiAgICAgICAgICAgICAgICBtYXRjaGVzID0gW10sXHJcbiAgICAgICAgICAgICAgICBhZGRNYXRjaCA9IGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaChpdGVtLmJhY2tyZWYgPyAobWF0Y2hbaXRlbS5iYWNrcmVmXSB8fCBcIlwiKSA6IG1hdGNoWzBdKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBpO1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmZvckVhY2godmFsdWVzW2ldLCBpdGVtLnJlZ2V4LCBhZGRNYXRjaCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuICgobGV2ZWwgPT09IGNoYWluLmxlbmd0aCAtIDEpIHx8ICFtYXRjaGVzLmxlbmd0aCkgP1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMgOlxyXG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2VDaGFpbihtYXRjaGVzLCBsZXZlbCArIDEpO1xyXG4gICAgICAgIH0oW3N0cl0sIDApKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIG5ldyBzdHJpbmcgd2l0aCBvbmUgb3IgYWxsIG1hdGNoZXMgb2YgYSBwYXR0ZXJuIHJlcGxhY2VkLiBUaGUgcGF0dGVybiBjYW4gYmUgYSBzdHJpbmdcclxuICogb3IgcmVnZXgsIGFuZCB0aGUgcmVwbGFjZW1lbnQgY2FuIGJlIGEgc3RyaW5nIG9yIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGZvciBlYWNoIG1hdGNoLiBUb1xyXG4gKiBwZXJmb3JtIGEgZ2xvYmFsIHNlYXJjaCBhbmQgcmVwbGFjZSwgdXNlIHRoZSBvcHRpb25hbCBgc2NvcGVgIGFyZ3VtZW50IG9yIGluY2x1ZGUgZmxhZyBgZ2AgaWZcclxuICogdXNpbmcgYSByZWdleC4gUmVwbGFjZW1lbnQgc3RyaW5ncyBjYW4gdXNlIGAke259YCBmb3IgbmFtZWQgYW5kIG51bWJlcmVkIGJhY2tyZWZlcmVuY2VzLlxyXG4gKiBSZXBsYWNlbWVudCBmdW5jdGlvbnMgY2FuIHVzZSBuYW1lZCBiYWNrcmVmZXJlbmNlcyB2aWEgYGFyZ3VtZW50c1swXS5uYW1lYC4gQWxzbyBmaXhlcyBicm93c2VyXHJcbiAqIGJ1Z3MgY29tcGFyZWQgdG8gdGhlIG5hdGl2ZSBgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlYCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHkgY3Jvc3MtYnJvd3Nlci5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcGFyYW0ge1JlZ0V4cHxTdHJpbmd9IHNlYXJjaCBTZWFyY2ggcGF0dGVybiB0byBiZSByZXBsYWNlZC5cclxuICogQHBhcmFtIHtTdHJpbmd8RnVuY3Rpb259IHJlcGxhY2VtZW50IFJlcGxhY2VtZW50IHN0cmluZyBvciBhIGZ1bmN0aW9uIGludm9rZWQgdG8gY3JlYXRlIGl0LlxyXG4gKiAgIFJlcGxhY2VtZW50IHN0cmluZ3MgY2FuIGluY2x1ZGUgc3BlY2lhbCByZXBsYWNlbWVudCBzeW50YXg6XHJcbiAqICAgICA8bGk+JCQgLSBJbnNlcnRzIGEgbGl0ZXJhbCAnJCcuXHJcbiAqICAgICA8bGk+JCYsICQwIC0gSW5zZXJ0cyB0aGUgbWF0Y2hlZCBzdWJzdHJpbmcuXHJcbiAqICAgICA8bGk+JGAgLSBJbnNlcnRzIHRoZSBzdHJpbmcgdGhhdCBwcmVjZWRlcyB0aGUgbWF0Y2hlZCBzdWJzdHJpbmcgKGxlZnQgY29udGV4dCkuXHJcbiAqICAgICA8bGk+JCcgLSBJbnNlcnRzIHRoZSBzdHJpbmcgdGhhdCBmb2xsb3dzIHRoZSBtYXRjaGVkIHN1YnN0cmluZyAocmlnaHQgY29udGV4dCkuXHJcbiAqICAgICA8bGk+JG4sICRubiAtIFdoZXJlIG4vbm4gYXJlIGRpZ2l0cyByZWZlcmVuY2luZyBhbiBleGlzdGVudCBjYXB0dXJpbmcgZ3JvdXAsIGluc2VydHNcclxuICogICAgICAgYmFja3JlZmVyZW5jZSBuL25uLlxyXG4gKiAgICAgPGxpPiR7bn0gLSBXaGVyZSBuIGlzIGEgbmFtZSBvciBhbnkgbnVtYmVyIG9mIGRpZ2l0cyB0aGF0IHJlZmVyZW5jZSBhbiBleGlzdGVudCBjYXB0dXJpbmdcclxuICogICAgICAgZ3JvdXAsIGluc2VydHMgYmFja3JlZmVyZW5jZSBuLlxyXG4gKiAgIFJlcGxhY2VtZW50IGZ1bmN0aW9ucyBhcmUgaW52b2tlZCB3aXRoIHRocmVlIG9yIG1vcmUgYXJndW1lbnRzOlxyXG4gKiAgICAgPGxpPlRoZSBtYXRjaGVkIHN1YnN0cmluZyAoY29ycmVzcG9uZHMgdG8gJCYgYWJvdmUpLiBOYW1lZCBiYWNrcmVmZXJlbmNlcyBhcmUgYWNjZXNzaWJsZSBhc1xyXG4gKiAgICAgICBwcm9wZXJ0aWVzIG9mIHRoaXMgZmlyc3QgYXJndW1lbnQuXHJcbiAqICAgICA8bGk+MC4ubiBhcmd1bWVudHMsIG9uZSBmb3IgZWFjaCBiYWNrcmVmZXJlbmNlIChjb3JyZXNwb25kaW5nIHRvICQxLCAkMiwgZXRjLiBhYm92ZSkuXHJcbiAqICAgICA8bGk+VGhlIHplcm8tYmFzZWQgaW5kZXggb2YgdGhlIG1hdGNoIHdpdGhpbiB0aGUgdG90YWwgc2VhcmNoIHN0cmluZy5cclxuICogICAgIDxsaT5UaGUgdG90YWwgc3RyaW5nIGJlaW5nIHNlYXJjaGVkLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW3Njb3BlPSdvbmUnXSBVc2UgJ29uZScgdG8gcmVwbGFjZSB0aGUgZmlyc3QgbWF0Y2ggb25seSwgb3IgJ2FsbCcuIElmIG5vdFxyXG4gKiAgIGV4cGxpY2l0bHkgc3BlY2lmaWVkIGFuZCB1c2luZyBhIHJlZ2V4IHdpdGggZmxhZyBgZ2AsIGBzY29wZWAgaXMgJ2FsbCcuXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IE5ldyBzdHJpbmcgd2l0aCBvbmUgb3IgYWxsIG1hdGNoZXMgcmVwbGFjZWQuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIFJlZ2V4IHNlYXJjaCwgdXNpbmcgbmFtZWQgYmFja3JlZmVyZW5jZXMgaW4gcmVwbGFjZW1lbnQgc3RyaW5nXHJcbiAqIHZhciBuYW1lID0gWFJlZ0V4cCgnKD88Zmlyc3Q+XFxcXHcrKSAoPzxsYXN0PlxcXFx3KyknKTtcclxuICogWFJlZ0V4cC5yZXBsYWNlKCdKb2huIFNtaXRoJywgbmFtZSwgJyR7bGFzdH0sICR7Zmlyc3R9Jyk7XHJcbiAqIC8vIC0+ICdTbWl0aCwgSm9obidcclxuICpcclxuICogLy8gUmVnZXggc2VhcmNoLCB1c2luZyBuYW1lZCBiYWNrcmVmZXJlbmNlcyBpbiByZXBsYWNlbWVudCBmdW5jdGlvblxyXG4gKiBYUmVnRXhwLnJlcGxhY2UoJ0pvaG4gU21pdGgnLCBuYW1lLCBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICogICByZXR1cm4gbWF0Y2gubGFzdCArICcsICcgKyBtYXRjaC5maXJzdDtcclxuICogfSk7XHJcbiAqIC8vIC0+ICdTbWl0aCwgSm9obidcclxuICpcclxuICogLy8gR2xvYmFsIHN0cmluZyBzZWFyY2gvcmVwbGFjZW1lbnRcclxuICogWFJlZ0V4cC5yZXBsYWNlKCdSZWdFeHAgYnVpbGRzIFJlZ0V4cHMnLCAnUmVnRXhwJywgJ1hSZWdFeHAnLCAnYWxsJyk7XHJcbiAqIC8vIC0+ICdYUmVnRXhwIGJ1aWxkcyBYUmVnRXhwcydcclxuICovXHJcbiAgICBzZWxmLnJlcGxhY2UgPSBmdW5jdGlvbiAoc3RyLCBzZWFyY2gsIHJlcGxhY2VtZW50LCBzY29wZSkge1xyXG4gICAgICAgIHZhciBpc1JlZ2V4ID0gc2VsZi5pc1JlZ0V4cChzZWFyY2gpLFxyXG4gICAgICAgICAgICBzZWFyY2gyID0gc2VhcmNoLFxyXG4gICAgICAgICAgICByZXN1bHQ7XHJcbiAgICAgICAgaWYgKGlzUmVnZXgpIHtcclxuICAgICAgICAgICAgaWYgKHNjb3BlID09PSB1bmRlZiAmJiBzZWFyY2guZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgICAgICBzY29wZSA9IFwiYWxsXCI7IC8vIEZvbGxvdyBmbGFnIGcgd2hlbiBgc2NvcGVgIGlzbid0IGV4cGxpY2l0XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gTm90ZSB0aGF0IHNpbmNlIGEgY29weSBpcyB1c2VkLCBgc2VhcmNoYCdzIGBsYXN0SW5kZXhgIGlzbid0IHVwZGF0ZWQgKmR1cmluZyogcmVwbGFjZW1lbnQgaXRlcmF0aW9uc1xyXG4gICAgICAgICAgICBzZWFyY2gyID0gY29weShzZWFyY2gsIHNjb3BlID09PSBcImFsbFwiID8gXCJnXCIgOiBcIlwiLCBzY29wZSA9PT0gXCJhbGxcIiA/IFwiXCIgOiBcImdcIik7XHJcbiAgICAgICAgfSBlbHNlIGlmIChzY29wZSA9PT0gXCJhbGxcIikge1xyXG4gICAgICAgICAgICBzZWFyY2gyID0gbmV3IFJlZ0V4cChzZWxmLmVzY2FwZShTdHJpbmcoc2VhcmNoKSksIFwiZ1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzdWx0ID0gZml4ZWQucmVwbGFjZS5jYWxsKFN0cmluZyhzdHIpLCBzZWFyY2gyLCByZXBsYWNlbWVudCk7IC8vIEZpeGVkIGByZXBsYWNlYCByZXF1aXJlZCBmb3IgbmFtZWQgYmFja3JlZmVyZW5jZXMsIGV0Yy5cclxuICAgICAgICBpZiAoaXNSZWdleCAmJiBzZWFyY2guZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgIHNlYXJjaC5sYXN0SW5kZXggPSAwOyAvLyBGaXhlcyBJRSwgU2FmYXJpIGJ1ZyAobGFzdCB0ZXN0ZWQgSUUgOSwgU2FmYXJpIDUuMSlcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogU3BsaXRzIGEgc3RyaW5nIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncyB1c2luZyBhIHJlZ2V4IG9yIHN0cmluZyBzZXBhcmF0b3IuIE1hdGNoZXMgb2YgdGhlXHJcbiAqIHNlcGFyYXRvciBhcmUgbm90IGluY2x1ZGVkIGluIHRoZSByZXN1bHQgYXJyYXkuIEhvd2V2ZXIsIGlmIGBzZXBhcmF0b3JgIGlzIGEgcmVnZXggdGhhdCBjb250YWluc1xyXG4gKiBjYXB0dXJpbmcgZ3JvdXBzLCBiYWNrcmVmZXJlbmNlcyBhcmUgc3BsaWNlZCBpbnRvIHRoZSByZXN1bHQgZWFjaCB0aW1lIGBzZXBhcmF0b3JgIGlzIG1hdGNoZWQuXHJcbiAqIEZpeGVzIGJyb3dzZXIgYnVncyBjb21wYXJlZCB0byB0aGUgbmF0aXZlIGBTdHJpbmcucHJvdG90eXBlLnNwbGl0YCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHlcclxuICogY3Jvc3MtYnJvd3Nlci5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc3BsaXQuXHJcbiAqIEBwYXJhbSB7UmVnRXhwfFN0cmluZ30gc2VwYXJhdG9yIFJlZ2V4IG9yIHN0cmluZyB0byB1c2UgZm9yIHNlcGFyYXRpbmcgdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtsaW1pdF0gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzdWx0IGFycmF5LlxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IEFycmF5IG9mIHN1YnN0cmluZ3MuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEJhc2ljIHVzZVxyXG4gKiBYUmVnRXhwLnNwbGl0KCdhIGIgYycsICcgJyk7XHJcbiAqIC8vIC0+IFsnYScsICdiJywgJ2MnXVxyXG4gKlxyXG4gKiAvLyBXaXRoIGxpbWl0XHJcbiAqIFhSZWdFeHAuc3BsaXQoJ2EgYiBjJywgJyAnLCAyKTtcclxuICogLy8gLT4gWydhJywgJ2InXVxyXG4gKlxyXG4gKiAvLyBCYWNrcmVmZXJlbmNlcyBpbiByZXN1bHQgYXJyYXlcclxuICogWFJlZ0V4cC5zcGxpdCgnLi53b3JkMS4uJywgLyhbYS16XSspKFxcZCspL2kpO1xyXG4gKiAvLyAtPiBbJy4uJywgJ3dvcmQnLCAnMScsICcuLiddXHJcbiAqL1xyXG4gICAgc2VsZi5zcGxpdCA9IGZ1bmN0aW9uIChzdHIsIHNlcGFyYXRvciwgbGltaXQpIHtcclxuICAgICAgICByZXR1cm4gZml4ZWQuc3BsaXQuY2FsbChzdHIsIHNlcGFyYXRvciwgbGltaXQpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBFeGVjdXRlcyBhIHJlZ2V4IHNlYXJjaCBpbiBhIHNwZWNpZmllZCBzdHJpbmcuIFJldHVybnMgYHRydWVgIG9yIGBmYWxzZWAuIE9wdGlvbmFsIGBwb3NgIGFuZFxyXG4gKiBgc3RpY2t5YCBhcmd1bWVudHMgc3BlY2lmeSB0aGUgc2VhcmNoIHN0YXJ0IHBvc2l0aW9uLCBhbmQgd2hldGhlciB0aGUgbWF0Y2ggbXVzdCBzdGFydCBhdCB0aGVcclxuICogc3BlY2lmaWVkIHBvc2l0aW9uIG9ubHkuIFRoZSBgbGFzdEluZGV4YCBwcm9wZXJ0eSBvZiB0aGUgcHJvdmlkZWQgcmVnZXggaXMgbm90IHVzZWQsIGJ1dCBpc1xyXG4gKiB1cGRhdGVkIGZvciBjb21wYXRpYmlsaXR5LiBBbHNvIGZpeGVzIGJyb3dzZXIgYnVncyBjb21wYXJlZCB0byB0aGUgbmF0aXZlXHJcbiAqIGBSZWdFeHAucHJvdG90eXBlLnRlc3RgIGFuZCBjYW4gYmUgdXNlZCByZWxpYWJseSBjcm9zcy1icm93c2VyLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzZWFyY2guXHJcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdleCBSZWdleCB0byBzZWFyY2ggd2l0aC5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtwb3M9MF0gWmVyby1iYXNlZCBpbmRleCBhdCB3aGljaCB0byBzdGFydCB0aGUgc2VhcmNoLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW58U3RyaW5nfSBbc3RpY2t5PWZhbHNlXSBXaGV0aGVyIHRoZSBtYXRjaCBtdXN0IHN0YXJ0IGF0IHRoZSBzcGVjaWZpZWQgcG9zaXRpb25cclxuICogICBvbmx5LiBUaGUgc3RyaW5nIGAnc3RpY2t5J2AgaXMgYWNjZXB0ZWQgYXMgYW4gYWx0ZXJuYXRpdmUgdG8gYHRydWVgLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciB0aGUgcmVnZXggbWF0Y2hlZCB0aGUgcHJvdmlkZWQgdmFsdWUuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIEJhc2ljIHVzZVxyXG4gKiBYUmVnRXhwLnRlc3QoJ2FiYycsIC9jLyk7IC8vIC0+IHRydWVcclxuICpcclxuICogLy8gV2l0aCBwb3MgYW5kIHN0aWNreVxyXG4gKiBYUmVnRXhwLnRlc3QoJ2FiYycsIC9jLywgMCwgJ3N0aWNreScpOyAvLyAtPiBmYWxzZVxyXG4gKi9cclxuICAgIHNlbGYudGVzdCA9IGZ1bmN0aW9uIChzdHIsIHJlZ2V4LCBwb3MsIHN0aWNreSkge1xyXG4gICAgICAgIC8vIERvIHRoaXMgdGhlIGVhc3kgd2F5IDotKVxyXG4gICAgICAgIHJldHVybiAhIXNlbGYuZXhlYyhzdHIsIHJlZ2V4LCBwb3MsIHN0aWNreSk7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFVuaW5zdGFsbHMgb3B0aW9uYWwgZmVhdHVyZXMgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpZWQgb3B0aW9ucy5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBvcHRpb25zIE9wdGlvbnMgb2JqZWN0IG9yIHN0cmluZy5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gV2l0aCBhbiBvcHRpb25zIG9iamVjdFxyXG4gKiBYUmVnRXhwLnVuaW5zdGFsbCh7XHJcbiAqICAgLy8gUmVzdG9yZXMgbmF0aXZlIHJlZ2V4IG1ldGhvZHNcclxuICogICBuYXRpdmVzOiB0cnVlLFxyXG4gKlxyXG4gKiAgIC8vIERpc2FibGVzIGFkZGl0aW9uYWwgc3ludGF4IGFuZCBmbGFnIGV4dGVuc2lvbnNcclxuICogICBleHRlbnNpYmlsaXR5OiB0cnVlXHJcbiAqIH0pO1xyXG4gKlxyXG4gKiAvLyBXaXRoIGFuIG9wdGlvbnMgc3RyaW5nXHJcbiAqIFhSZWdFeHAudW5pbnN0YWxsKCduYXRpdmVzIGV4dGVuc2liaWxpdHknKTtcclxuICpcclxuICogLy8gVXNpbmcgYSBzaG9ydGN1dCB0byB1bmluc3RhbGwgYWxsIG9wdGlvbmFsIGZlYXR1cmVzXHJcbiAqIFhSZWdFeHAudW5pbnN0YWxsKCdhbGwnKTtcclxuICovXHJcbiAgICBzZWxmLnVuaW5zdGFsbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgICAgICAgb3B0aW9ucyA9IHByZXBhcmVPcHRpb25zKG9wdGlvbnMpO1xyXG4gICAgICAgIGlmIChmZWF0dXJlcy5uYXRpdmVzICYmIG9wdGlvbnMubmF0aXZlcykge1xyXG4gICAgICAgICAgICBzZXROYXRpdmVzKGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZlYXR1cmVzLmV4dGVuc2liaWxpdHkgJiYgb3B0aW9ucy5leHRlbnNpYmlsaXR5KSB7XHJcbiAgICAgICAgICAgIHNldEV4dGVuc2liaWxpdHkoZmFsc2UpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhbiBYUmVnRXhwIG9iamVjdCB0aGF0IGlzIHRoZSB1bmlvbiBvZiB0aGUgZ2l2ZW4gcGF0dGVybnMuIFBhdHRlcm5zIGNhbiBiZSBwcm92aWRlZCBhc1xyXG4gKiByZWdleCBvYmplY3RzIG9yIHN0cmluZ3MuIE1ldGFjaGFyYWN0ZXJzIGFyZSBlc2NhcGVkIGluIHBhdHRlcm5zIHByb3ZpZGVkIGFzIHN0cmluZ3MuXHJcbiAqIEJhY2tyZWZlcmVuY2VzIGluIHByb3ZpZGVkIHJlZ2V4IG9iamVjdHMgYXJlIGF1dG9tYXRpY2FsbHkgcmVudW1iZXJlZCB0byB3b3JrIGNvcnJlY3RseS4gTmF0aXZlXHJcbiAqIGZsYWdzIHVzZWQgYnkgcHJvdmlkZWQgcmVnZXhlcyBhcmUgaWdub3JlZCBpbiBmYXZvciBvZiB0aGUgYGZsYWdzYCBhcmd1bWVudC5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtBcnJheX0gcGF0dGVybnMgUmVnZXhlcyBhbmQgc3RyaW5ncyB0byBjb21iaW5lLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2ZsYWdzXSBBbnkgY29tYmluYXRpb24gb2YgWFJlZ0V4cCBmbGFncy5cclxuICogQHJldHVybnMge1JlZ0V4cH0gVW5pb24gb2YgdGhlIHByb3ZpZGVkIHJlZ2V4ZXMgYW5kIHN0cmluZ3MuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAudW5pb24oWydhK2IqYycsIC8oZG9ncylcXDEvLCAvKGNhdHMpXFwxL10sICdpJyk7XHJcbiAqIC8vIC0+IC9hXFwrYlxcKmN8KGRvZ3MpXFwxfChjYXRzKVxcMi9pXHJcbiAqXHJcbiAqIFhSZWdFeHAudW5pb24oW1hSZWdFeHAoJyg/PHBldD5kb2dzKVxcXFxrPHBldD4nKSwgWFJlZ0V4cCgnKD88cGV0PmNhdHMpXFxcXGs8cGV0PicpXSk7XHJcbiAqIC8vIC0+IFhSZWdFeHAoJyg/PHBldD5kb2dzKVxcXFxrPHBldD58KD88cGV0PmNhdHMpXFxcXGs8cGV0PicpXHJcbiAqL1xyXG4gICAgc2VsZi51bmlvbiA9IGZ1bmN0aW9uIChwYXR0ZXJucywgZmxhZ3MpIHtcclxuICAgICAgICB2YXIgcGFydHMgPSAvKFxcKCkoPyFcXD8pfFxcXFwoWzEtOV1cXGQqKXxcXFxcW1xcc1xcU118XFxbKD86W15cXFxcXFxdXXxcXFxcW1xcc1xcU10pKl0vZyxcclxuICAgICAgICAgICAgbnVtQ2FwdHVyZXMgPSAwLFxyXG4gICAgICAgICAgICBudW1QcmlvckNhcHR1cmVzLFxyXG4gICAgICAgICAgICBjYXB0dXJlTmFtZXMsXHJcbiAgICAgICAgICAgIHJld3JpdGUgPSBmdW5jdGlvbiAobWF0Y2gsIHBhcmVuLCBiYWNrcmVmKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IGNhcHR1cmVOYW1lc1tudW1DYXB0dXJlcyAtIG51bVByaW9yQ2FwdHVyZXNdO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVuKSB7IC8vIENhcHR1cmluZyBncm91cFxyXG4gICAgICAgICAgICAgICAgICAgICsrbnVtQ2FwdHVyZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUpIHsgLy8gSWYgdGhlIGN1cnJlbnQgY2FwdHVyZSBoYXMgYSBuYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIig/PFwiICsgbmFtZSArIFwiPlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYmFja3JlZikgeyAvLyBCYWNrcmVmZXJlbmNlXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiXFxcXFwiICsgKCtiYWNrcmVmICsgbnVtUHJpb3JDYXB0dXJlcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2g7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG91dHB1dCA9IFtdLFxyXG4gICAgICAgICAgICBwYXR0ZXJuLFxyXG4gICAgICAgICAgICBpO1xyXG4gICAgICAgIGlmICghKGlzVHlwZShwYXR0ZXJucywgXCJhcnJheVwiKSAmJiBwYXR0ZXJucy5sZW5ndGgpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwYXR0ZXJucyBtdXN0IGJlIGEgbm9uZW1wdHkgYXJyYXlcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXR0ZXJucy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBwYXR0ZXJuID0gcGF0dGVybnNbaV07XHJcbiAgICAgICAgICAgIGlmIChzZWxmLmlzUmVnRXhwKHBhdHRlcm4pKSB7XHJcbiAgICAgICAgICAgICAgICBudW1QcmlvckNhcHR1cmVzID0gbnVtQ2FwdHVyZXM7XHJcbiAgICAgICAgICAgICAgICBjYXB0dXJlTmFtZXMgPSAocGF0dGVybi54cmVnZXhwICYmIHBhdHRlcm4ueHJlZ2V4cC5jYXB0dXJlTmFtZXMpIHx8IFtdO1xyXG4gICAgICAgICAgICAgICAgLy8gUmV3cml0ZSBiYWNrcmVmZXJlbmNlcy4gUGFzc2luZyB0byBYUmVnRXhwIGRpZXMgb24gb2N0YWxzIGFuZCBlbnN1cmVzIHBhdHRlcm5zXHJcbiAgICAgICAgICAgICAgICAvLyBhcmUgaW5kZXBlbmRlbnRseSB2YWxpZDsgaGVscHMga2VlcCB0aGlzIHNpbXBsZS4gTmFtZWQgY2FwdHVyZXMgYXJlIHB1dCBiYWNrXHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChzZWxmKHBhdHRlcm4uc291cmNlKS5zb3VyY2UucmVwbGFjZShwYXJ0cywgcmV3cml0ZSkpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goc2VsZi5lc2NhcGUocGF0dGVybikpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzZWxmKG91dHB1dC5qb2luKFwifFwiKSwgZmxhZ3MpO1xyXG4gICAgfTtcclxuXHJcbi8qKlxyXG4gKiBUaGUgWFJlZ0V4cCB2ZXJzaW9uIG51bWJlci5cclxuICogQHN0YXRpY1xyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAdHlwZSBTdHJpbmdcclxuICovXHJcbiAgICBzZWxmLnZlcnNpb24gPSBcIjIuMC4wXCI7XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBGaXhlZC9leHRlbmRlZCBuYXRpdmUgbWV0aG9kc1xyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4vKipcclxuICogQWRkcyBuYW1lZCBjYXB0dXJlIHN1cHBvcnQgKHdpdGggYmFja3JlZmVyZW5jZXMgcmV0dXJuZWQgYXMgYHJlc3VsdC5uYW1lYCksIGFuZCBmaXhlcyBicm93c2VyXHJcbiAqIGJ1Z3MgaW4gdGhlIG5hdGl2ZSBgUmVnRXhwLnByb3RvdHlwZS5leGVjYC4gQ2FsbGluZyBgWFJlZ0V4cC5pbnN0YWxsKCduYXRpdmVzJylgIHVzZXMgdGhpcyB0b1xyXG4gKiBvdmVycmlkZSB0aGUgbmF0aXZlIG1ldGhvZC4gVXNlIHZpYSBgWFJlZ0V4cC5leGVjYCB3aXRob3V0IG92ZXJyaWRpbmcgbmF0aXZlcy5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IE1hdGNoIGFycmF5IHdpdGggbmFtZWQgYmFja3JlZmVyZW5jZSBwcm9wZXJ0aWVzLCBvciBudWxsLlxyXG4gKi9cclxuICAgIGZpeGVkLmV4ZWMgPSBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgdmFyIG1hdGNoLCBuYW1lLCByMiwgb3JpZ0xhc3RJbmRleCwgaTtcclxuICAgICAgICBpZiAoIXRoaXMuZ2xvYmFsKSB7XHJcbiAgICAgICAgICAgIG9yaWdMYXN0SW5kZXggPSB0aGlzLmxhc3RJbmRleDtcclxuICAgICAgICB9XHJcbiAgICAgICAgbWF0Y2ggPSBuYXRpdi5leGVjLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vIEZpeCBicm93c2VycyB3aG9zZSBgZXhlY2AgbWV0aG9kcyBkb24ndCBjb25zaXN0ZW50bHkgcmV0dXJuIGB1bmRlZmluZWRgIGZvclxyXG4gICAgICAgICAgICAvLyBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cHNcclxuICAgICAgICAgICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZyAmJiBtYXRjaC5sZW5ndGggPiAxICYmIGxhc3RJbmRleE9mKG1hdGNoLCBcIlwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgICAgICByMiA9IG5ldyBSZWdFeHAodGhpcy5zb3VyY2UsIG5hdGl2LnJlcGxhY2UuY2FsbChnZXROYXRpdmVGbGFncyh0aGlzKSwgXCJnXCIsIFwiXCIpKTtcclxuICAgICAgICAgICAgICAgIC8vIFVzaW5nIGBzdHIuc2xpY2UobWF0Y2guaW5kZXgpYCByYXRoZXIgdGhhbiBgbWF0Y2hbMF1gIGluIGNhc2UgbG9va2FoZWFkIGFsbG93ZWRcclxuICAgICAgICAgICAgICAgIC8vIG1hdGNoaW5nIGR1ZSB0byBjaGFyYWN0ZXJzIG91dHNpZGUgdGhlIG1hdGNoXHJcbiAgICAgICAgICAgICAgICBuYXRpdi5yZXBsYWNlLmNhbGwoU3RyaW5nKHN0cikuc2xpY2UobWF0Y2guaW5kZXgpLCByMiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMjsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHNbaV0gPT09IHVuZGVmKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaFtpXSA9IHVuZGVmO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gQXR0YWNoIG5hbWVkIGNhcHR1cmUgcHJvcGVydGllc1xyXG4gICAgICAgICAgICBpZiAodGhpcy54cmVnZXhwICYmIHRoaXMueHJlZ2V4cC5jYXB0dXJlTmFtZXMpIHtcclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBtYXRjaC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgPSB0aGlzLnhyZWdleHAuY2FwdHVyZU5hbWVzW2kgLSAxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaFtuYW1lXSA9IG1hdGNoW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBGaXggYnJvd3NlcnMgdGhhdCBpbmNyZW1lbnQgYGxhc3RJbmRleGAgYWZ0ZXIgemVyby1sZW5ndGggbWF0Y2hlc1xyXG4gICAgICAgICAgICBpZiAodGhpcy5nbG9iYWwgJiYgIW1hdGNoWzBdLmxlbmd0aCAmJiAodGhpcy5sYXN0SW5kZXggPiBtYXRjaC5pbmRleCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubGFzdEluZGV4ID0gbWF0Y2guaW5kZXg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLmdsb2JhbCkge1xyXG4gICAgICAgICAgICB0aGlzLmxhc3RJbmRleCA9IG9yaWdMYXN0SW5kZXg7IC8vIEZpeGVzIElFLCBPcGVyYSBidWcgKGxhc3QgdGVzdGVkIElFIDksIE9wZXJhIDExLjYpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBtYXRjaDtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogRml4ZXMgYnJvd3NlciBidWdzIGluIHRoZSBuYXRpdmUgYFJlZ0V4cC5wcm90b3R5cGUudGVzdGAuIENhbGxpbmcgYFhSZWdFeHAuaW5zdGFsbCgnbmF0aXZlcycpYFxyXG4gKiB1c2VzIHRoaXMgdG8gb3ZlcnJpZGUgdGhlIG5hdGl2ZSBtZXRob2QuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNlYXJjaC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHJlZ2V4IG1hdGNoZWQgdGhlIHByb3ZpZGVkIHZhbHVlLlxyXG4gKi9cclxuICAgIGZpeGVkLnRlc3QgPSBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgLy8gRG8gdGhpcyB0aGUgZWFzeSB3YXkgOi0pXHJcbiAgICAgICAgcmV0dXJuICEhZml4ZWQuZXhlYy5jYWxsKHRoaXMsIHN0cik7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgbmFtZWQgY2FwdHVyZSBzdXBwb3J0ICh3aXRoIGJhY2tyZWZlcmVuY2VzIHJldHVybmVkIGFzIGByZXN1bHQubmFtZWApLCBhbmQgZml4ZXMgYnJvd3NlclxyXG4gKiBidWdzIGluIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUubWF0Y2hgLiBDYWxsaW5nIGBYUmVnRXhwLmluc3RhbGwoJ25hdGl2ZXMnKWAgdXNlcyB0aGlzIHRvXHJcbiAqIG92ZXJyaWRlIHRoZSBuYXRpdmUgbWV0aG9kLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXggUmVnZXggdG8gc2VhcmNoIHdpdGguXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gSWYgYHJlZ2V4YCB1c2VzIGZsYWcgZywgYW4gYXJyYXkgb2YgbWF0Y2ggc3RyaW5ncyBvciBudWxsLiBXaXRob3V0IGZsYWcgZywgdGhlXHJcbiAqICAgcmVzdWx0IG9mIGNhbGxpbmcgYHJlZ2V4LmV4ZWModGhpcylgLlxyXG4gKi9cclxuICAgIGZpeGVkLm1hdGNoID0gZnVuY3Rpb24gKHJlZ2V4KSB7XHJcbiAgICAgICAgaWYgKCFzZWxmLmlzUmVnRXhwKHJlZ2V4KSkge1xyXG4gICAgICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgpOyAvLyBVc2UgbmF0aXZlIGBSZWdFeHBgXHJcbiAgICAgICAgfSBlbHNlIGlmIChyZWdleC5nbG9iYWwpIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IG5hdGl2Lm1hdGNoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgICAgIHJlZ2V4Lmxhc3RJbmRleCA9IDA7IC8vIEZpeGVzIElFIGJ1Z1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZml4ZWQuZXhlYy5jYWxsKHJlZ2V4LCB0aGlzKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogQWRkcyBzdXBwb3J0IGZvciBgJHtufWAgdG9rZW5zIGZvciBuYW1lZCBhbmQgbnVtYmVyZWQgYmFja3JlZmVyZW5jZXMgaW4gcmVwbGFjZW1lbnQgdGV4dCwgYW5kXHJcbiAqIHByb3ZpZGVzIG5hbWVkIGJhY2tyZWZlcmVuY2VzIHRvIHJlcGxhY2VtZW50IGZ1bmN0aW9ucyBhcyBgYXJndW1lbnRzWzBdLm5hbWVgLiBBbHNvIGZpeGVzXHJcbiAqIGJyb3dzZXIgYnVncyBpbiByZXBsYWNlbWVudCB0ZXh0IHN5bnRheCB3aGVuIHBlcmZvcm1pbmcgYSByZXBsYWNlbWVudCB1c2luZyBhIG5vbnJlZ2V4IHNlYXJjaFxyXG4gKiB2YWx1ZSwgYW5kIHRoZSB2YWx1ZSBvZiBhIHJlcGxhY2VtZW50IHJlZ2V4J3MgYGxhc3RJbmRleGAgcHJvcGVydHkgZHVyaW5nIHJlcGxhY2VtZW50IGl0ZXJhdGlvbnNcclxuICogYW5kIHVwb24gY29tcGxldGlvbi4gTm90ZSB0aGF0IHRoaXMgZG9lc24ndCBzdXBwb3J0IFNwaWRlck1vbmtleSdzIHByb3ByaWV0YXJ5IHRoaXJkIChgZmxhZ3NgKVxyXG4gKiBhcmd1bWVudC4gQ2FsbGluZyBgWFJlZ0V4cC5pbnN0YWxsKCduYXRpdmVzJylgIHVzZXMgdGhpcyB0byBvdmVycmlkZSB0aGUgbmF0aXZlIG1ldGhvZC4gVXNlIHZpYVxyXG4gKiBgWFJlZ0V4cC5yZXBsYWNlYCB3aXRob3V0IG92ZXJyaWRpbmcgbmF0aXZlcy5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZWFyY2ggU2VhcmNoIHBhdHRlcm4gdG8gYmUgcmVwbGFjZWQuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfEZ1bmN0aW9ufSByZXBsYWNlbWVudCBSZXBsYWNlbWVudCBzdHJpbmcgb3IgYSBmdW5jdGlvbiBpbnZva2VkIHRvIGNyZWF0ZSBpdC5cclxuICogQHJldHVybnMge1N0cmluZ30gTmV3IHN0cmluZyB3aXRoIG9uZSBvciBhbGwgbWF0Y2hlcyByZXBsYWNlZC5cclxuICovXHJcbiAgICBmaXhlZC5yZXBsYWNlID0gZnVuY3Rpb24gKHNlYXJjaCwgcmVwbGFjZW1lbnQpIHtcclxuICAgICAgICB2YXIgaXNSZWdleCA9IHNlbGYuaXNSZWdFeHAoc2VhcmNoKSwgY2FwdHVyZU5hbWVzLCByZXN1bHQsIHN0ciwgb3JpZ0xhc3RJbmRleDtcclxuICAgICAgICBpZiAoaXNSZWdleCkge1xyXG4gICAgICAgICAgICBpZiAoc2VhcmNoLnhyZWdleHApIHtcclxuICAgICAgICAgICAgICAgIGNhcHR1cmVOYW1lcyA9IHNlYXJjaC54cmVnZXhwLmNhcHR1cmVOYW1lcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIXNlYXJjaC5nbG9iYWwpIHtcclxuICAgICAgICAgICAgICAgIG9yaWdMYXN0SW5kZXggPSBzZWFyY2gubGFzdEluZGV4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc2VhcmNoICs9IFwiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpc1R5cGUocmVwbGFjZW1lbnQsIFwiZnVuY3Rpb25cIikpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gbmF0aXYucmVwbGFjZS5jYWxsKFN0cmluZyh0aGlzKSwgc2VhcmNoLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cywgaTtcclxuICAgICAgICAgICAgICAgIGlmIChjYXB0dXJlTmFtZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBDaGFuZ2UgdGhlIGBhcmd1bWVudHNbMF1gIHN0cmluZyBwcmltaXRpdmUgdG8gYSBgU3RyaW5nYCBvYmplY3QgdGhhdCBjYW4gc3RvcmUgcHJvcGVydGllc1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3NbMF0gPSBuZXcgU3RyaW5nKGFyZ3NbMF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIG5hbWVkIGJhY2tyZWZlcmVuY2VzIG9uIHRoZSBmaXJzdCBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYXB0dXJlTmFtZXMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhcHR1cmVOYW1lc1tpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJnc1swXVtjYXB0dXJlTmFtZXNbaV1dID0gYXJnc1tpICsgMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgYGxhc3RJbmRleGAgYmVmb3JlIGNhbGxpbmcgYHJlcGxhY2VtZW50YC5cclxuICAgICAgICAgICAgICAgIC8vIEZpeGVzIElFLCBDaHJvbWUsIEZpcmVmb3gsIFNhZmFyaSBidWcgKGxhc3QgdGVzdGVkIElFIDksIENocm9tZSAxNywgRmlyZWZveCAxMSwgU2FmYXJpIDUuMSlcclxuICAgICAgICAgICAgICAgIGlmIChpc1JlZ2V4ICYmIHNlYXJjaC5nbG9iYWwpIHtcclxuICAgICAgICAgICAgICAgICAgICBzZWFyY2gubGFzdEluZGV4ID0gYXJnc1thcmdzLmxlbmd0aCAtIDJdICsgYXJnc1swXS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVwbGFjZW1lbnQuYXBwbHkobnVsbCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHN0ciA9IFN0cmluZyh0aGlzKTsgLy8gRW5zdXJlIGBhcmdzW2FyZ3MubGVuZ3RoIC0gMV1gIHdpbGwgYmUgYSBzdHJpbmcgd2hlbiBnaXZlbiBub25zdHJpbmcgYHRoaXNgXHJcbiAgICAgICAgICAgIHJlc3VsdCA9IG5hdGl2LnJlcGxhY2UuY2FsbChzdHIsIHNlYXJjaCwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7IC8vIEtlZXAgdGhpcyBmdW5jdGlvbidzIGBhcmd1bWVudHNgIGF2YWlsYWJsZSB0aHJvdWdoIGNsb3N1cmVcclxuICAgICAgICAgICAgICAgIHJldHVybiBuYXRpdi5yZXBsYWNlLmNhbGwoU3RyaW5nKHJlcGxhY2VtZW50KSwgcmVwbGFjZW1lbnRUb2tlbiwgZnVuY3Rpb24gKCQwLCAkMSwgJDIpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbjtcclxuICAgICAgICAgICAgICAgICAgICAvLyBOYW1lZCBvciBudW1iZXJlZCBiYWNrcmVmZXJlbmNlIHdpdGggY3VybHkgYnJhY2tldHNcclxuICAgICAgICAgICAgICAgICAgICBpZiAoJDEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLyogWFJlZ0V4cCBiZWhhdmlvciBmb3IgYCR7bn1gOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiAxLiBCYWNrcmVmZXJlbmNlIHRvIG51bWJlcmVkIGNhcHR1cmUsIHdoZXJlIGBuYCBpcyAxKyBkaWdpdHMuIGAwYCwgYDAwYCwgZXRjLiBpcyB0aGUgZW50aXJlIG1hdGNoLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiAyLiBCYWNrcmVmZXJlbmNlIHRvIG5hbWVkIGNhcHR1cmUgYG5gLCBpZiBpdCBleGlzdHMgYW5kIGlzIG5vdCBhIG51bWJlciBvdmVycmlkZGVuIGJ5IG51bWJlcmVkIGNhcHR1cmUuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAqIDMuIE90aGVyd2lzZSwgaXQncyBhbiBlcnJvci5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG4gPSArJDE7IC8vIFR5cGUtY29udmVydDsgZHJvcCBsZWFkaW5nIHplcm9zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuIDw9IGFyZ3MubGVuZ3RoIC0gMykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3Nbbl0gfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuID0gY2FwdHVyZU5hbWVzID8gbGFzdEluZGV4T2YoY2FwdHVyZU5hbWVzLCAkMSkgOiAtMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG4gPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJiYWNrcmVmZXJlbmNlIHRvIHVuZGVmaW5lZCBncm91cCBcIiArICQwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXJnc1tuICsgMV0gfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gRWxzZSwgc3BlY2lhbCB2YXJpYWJsZSBvciBudW1iZXJlZCBiYWNrcmVmZXJlbmNlICh3aXRob3V0IGN1cmx5IGJyYWNrZXRzKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICgkMiA9PT0gXCIkXCIpIHJldHVybiBcIiRcIjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoJDIgPT09IFwiJlwiIHx8ICskMiA9PT0gMCkgcmV0dXJuIGFyZ3NbMF07IC8vICQmLCAkMCAobm90IGZvbGxvd2VkIGJ5IDEtOSksICQwMFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICgkMiA9PT0gXCJgXCIpIHJldHVybiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0uc2xpY2UoMCwgYXJnc1thcmdzLmxlbmd0aCAtIDJdKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoJDIgPT09IFwiJ1wiKSByZXR1cm4gYXJnc1thcmdzLmxlbmd0aCAtIDFdLnNsaWNlKGFyZ3NbYXJncy5sZW5ndGggLSAyXSArIGFyZ3NbMF0ubGVuZ3RoKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBFbHNlLCBudW1iZXJlZCBiYWNrcmVmZXJlbmNlICh3aXRob3V0IGN1cmx5IGJyYWNrZXRzKVxyXG4gICAgICAgICAgICAgICAgICAgICQyID0gKyQyOyAvLyBUeXBlLWNvbnZlcnQ7IGRyb3AgbGVhZGluZyB6ZXJvXHJcbiAgICAgICAgICAgICAgICAgICAgLyogWFJlZ0V4cCBiZWhhdmlvcjpcclxuICAgICAgICAgICAgICAgICAgICAgKiAtIEJhY2tyZWZlcmVuY2VzIHdpdGhvdXQgY3VybHkgYnJhY2tldHMgZW5kIGFmdGVyIDEgb3IgMiBkaWdpdHMuIFVzZSBgJHsuLn1gIGZvciBtb3JlIGRpZ2l0cy5cclxuICAgICAgICAgICAgICAgICAgICAgKiAtIGAkMWAgaXMgYW4gZXJyb3IgaWYgdGhlcmUgYXJlIG5vIGNhcHR1cmluZyBncm91cHMuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDEwYCBpcyBhbiBlcnJvciBpZiB0aGVyZSBhcmUgbGVzcyB0aGFuIDEwIGNhcHR1cmluZyBncm91cHMuIFVzZSBgJHsxfTBgIGluc3RlYWQuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDAxYCBpcyBlcXVpdmFsZW50IHRvIGAkMWAgaWYgYSBjYXB0dXJpbmcgZ3JvdXAgZXhpc3RzLCBvdGhlcndpc2UgaXQncyBhbiBlcnJvci5cclxuICAgICAgICAgICAgICAgICAgICAgKiAtIGAkMGAgKG5vdCBmb2xsb3dlZCBieSAxLTkpLCBgJDAwYCwgYW5kIGAkJmAgYXJlIHRoZSBlbnRpcmUgbWF0Y2guXHJcbiAgICAgICAgICAgICAgICAgICAgICogTmF0aXZlIGJlaGF2aW9yLCBmb3IgY29tcGFyaXNvbjpcclxuICAgICAgICAgICAgICAgICAgICAgKiAtIEJhY2tyZWZlcmVuY2VzIGVuZCBhZnRlciAxIG9yIDIgZGlnaXRzLiBDYW5ub3QgdXNlIGJhY2tyZWZlcmVuY2UgdG8gY2FwdHVyaW5nIGdyb3VwIDEwMCsuXHJcbiAgICAgICAgICAgICAgICAgICAgICogLSBgJDFgIGlzIGEgbGl0ZXJhbCBgJDFgIGlmIHRoZXJlIGFyZSBubyBjYXB0dXJpbmcgZ3JvdXBzLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIC0gYCQxMGAgaXMgYCQxYCBmb2xsb3dlZCBieSBhIGxpdGVyYWwgYDBgIGlmIHRoZXJlIGFyZSBsZXNzIHRoYW4gMTAgY2FwdHVyaW5nIGdyb3Vwcy5cclxuICAgICAgICAgICAgICAgICAgICAgKiAtIGAkMDFgIGlzIGVxdWl2YWxlbnQgdG8gYCQxYCBpZiBhIGNhcHR1cmluZyBncm91cCBleGlzdHMsIG90aGVyd2lzZSBpdCdzIGEgbGl0ZXJhbCBgJDAxYC5cclxuICAgICAgICAgICAgICAgICAgICAgKiAtIGAkMGAgaXMgYSBsaXRlcmFsIGAkMGAuIGAkJmAgaXMgdGhlIGVudGlyZSBtYXRjaC5cclxuICAgICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKCQyKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoJDIgPiBhcmdzLmxlbmd0aCAtIDMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImJhY2tyZWZlcmVuY2UgdG8gdW5kZWZpbmVkIGdyb3VwIFwiICsgJDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhcmdzWyQyXSB8fCBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJpbnZhbGlkIHRva2VuIFwiICsgJDApO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaXNSZWdleCkge1xyXG4gICAgICAgICAgICBpZiAoc2VhcmNoLmdsb2JhbCkge1xyXG4gICAgICAgICAgICAgICAgc2VhcmNoLmxhc3RJbmRleCA9IDA7IC8vIEZpeGVzIElFLCBTYWZhcmkgYnVnIChsYXN0IHRlc3RlZCBJRSA5LCBTYWZhcmkgNS4xKVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc2VhcmNoLmxhc3RJbmRleCA9IG9yaWdMYXN0SW5kZXg7IC8vIEZpeGVzIElFLCBPcGVyYSBidWcgKGxhc3QgdGVzdGVkIElFIDksIE9wZXJhIDExLjYpXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogRml4ZXMgYnJvd3NlciBidWdzIGluIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUuc3BsaXRgLiBDYWxsaW5nIGBYUmVnRXhwLmluc3RhbGwoJ25hdGl2ZXMnKWBcclxuICogdXNlcyB0aGlzIHRvIG92ZXJyaWRlIHRoZSBuYXRpdmUgbWV0aG9kLiBVc2UgdmlhIGBYUmVnRXhwLnNwbGl0YCB3aXRob3V0IG92ZXJyaWRpbmcgbmF0aXZlcy5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZXBhcmF0b3IgUmVnZXggb3Igc3RyaW5nIHRvIHVzZSBmb3Igc2VwYXJhdGluZyB0aGUgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gW2xpbWl0XSBNYXhpbXVtIG51bWJlciBvZiBpdGVtcyB0byBpbmNsdWRlIGluIHRoZSByZXN1bHQgYXJyYXkuXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gQXJyYXkgb2Ygc3Vic3RyaW5ncy5cclxuICovXHJcbiAgICBmaXhlZC5zcGxpdCA9IGZ1bmN0aW9uIChzZXBhcmF0b3IsIGxpbWl0KSB7XHJcbiAgICAgICAgaWYgKCFzZWxmLmlzUmVnRXhwKHNlcGFyYXRvcikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5hdGl2LnNwbGl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IC8vIHVzZSBmYXN0ZXIgbmF0aXZlIG1ldGhvZFxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgc3RyID0gU3RyaW5nKHRoaXMpLFxyXG4gICAgICAgICAgICBvcmlnTGFzdEluZGV4ID0gc2VwYXJhdG9yLmxhc3RJbmRleCxcclxuICAgICAgICAgICAgb3V0cHV0ID0gW10sXHJcbiAgICAgICAgICAgIGxhc3RMYXN0SW5kZXggPSAwLFxyXG4gICAgICAgICAgICBsYXN0TGVuZ3RoO1xyXG4gICAgICAgIC8qIFZhbHVlcyBmb3IgYGxpbWl0YCwgcGVyIHRoZSBzcGVjOlxyXG4gICAgICAgICAqIElmIHVuZGVmaW5lZDogcG93KDIsMzIpIC0gMVxyXG4gICAgICAgICAqIElmIDAsIEluZmluaXR5LCBvciBOYU46IDBcclxuICAgICAgICAgKiBJZiBwb3NpdGl2ZSBudW1iZXI6IGxpbWl0ID0gZmxvb3IobGltaXQpOyBpZiAobGltaXQgPj0gcG93KDIsMzIpKSBsaW1pdCAtPSBwb3coMiwzMik7XHJcbiAgICAgICAgICogSWYgbmVnYXRpdmUgbnVtYmVyOiBwb3coMiwzMikgLSBmbG9vcihhYnMobGltaXQpKVxyXG4gICAgICAgICAqIElmIG90aGVyOiBUeXBlLWNvbnZlcnQsIHRoZW4gdXNlIHRoZSBhYm92ZSBydWxlc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGxpbWl0ID0gKGxpbWl0ID09PSB1bmRlZiA/IC0xIDogbGltaXQpID4+PiAwO1xyXG4gICAgICAgIHNlbGYuZm9yRWFjaChzdHIsIHNlcGFyYXRvciwgZnVuY3Rpb24gKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGlmICgobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpID4gbGFzdExhc3RJbmRleCkgeyAvLyAhPSBgaWYgKG1hdGNoWzBdLmxlbmd0aClgXHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChzdHIuc2xpY2UobGFzdExhc3RJbmRleCwgbWF0Y2guaW5kZXgpKTtcclxuICAgICAgICAgICAgICAgIGlmIChtYXRjaC5sZW5ndGggPiAxICYmIG1hdGNoLmluZGV4IDwgc3RyLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KG91dHB1dCwgbWF0Y2guc2xpY2UoMSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGFzdExlbmd0aCA9IG1hdGNoWzBdLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIGxhc3RMYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIGxhc3RMZW5ndGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAobGFzdExhc3RJbmRleCA9PT0gc3RyLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBpZiAoIW5hdGl2LnRlc3QuY2FsbChzZXBhcmF0b3IsIFwiXCIpIHx8IGxhc3RMZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKFwiXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc2VwYXJhdG9yLmxhc3RJbmRleCA9IG9yaWdMYXN0SW5kZXg7XHJcbiAgICAgICAgcmV0dXJuIG91dHB1dC5sZW5ndGggPiBsaW1pdCA/IG91dHB1dC5zbGljZSgwLCBsaW1pdCkgOiBvdXRwdXQ7XHJcbiAgICB9O1xyXG5cclxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQnVpbHQtaW4gdG9rZW5zXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbi8vIFNob3J0Y3V0XHJcbiAgICBhZGQgPSBhZGRUb2tlbi5vbjtcclxuXHJcbi8qIExldHRlciBpZGVudGl0eSBlc2NhcGVzIHRoYXQgbmF0aXZlbHkgbWF0Y2ggbGl0ZXJhbCBjaGFyYWN0ZXJzOiBcXHAsIFxcUCwgZXRjLlxyXG4gKiBTaG91bGQgYmUgU3ludGF4RXJyb3JzIGJ1dCBhcmUgYWxsb3dlZCBpbiB3ZWIgcmVhbGl0eS4gWFJlZ0V4cCBtYWtlcyB0aGVtIGVycm9ycyBmb3IgY3Jvc3MtXHJcbiAqIGJyb3dzZXIgY29uc2lzdGVuY3kgYW5kIHRvIHJlc2VydmUgdGhlaXIgc3ludGF4LCBidXQgbGV0cyB0aGVtIGJlIHN1cGVyc2VkZWQgYnkgWFJlZ0V4cCBhZGRvbnMuXHJcbiAqL1xyXG4gICAgYWRkKC9cXFxcKFtBQkNFLVJUVVZYWVphZWctbW9wcXl6XXxjKD8hW0EtWmEtel0pfHUoPyFbXFxkQS1GYS1mXXs0fSl8eCg/IVtcXGRBLUZhLWZdezJ9KSkvLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCwgc2NvcGUpIHtcclxuICAgICAgICAgICAgLy8gXFxCIGlzIGFsbG93ZWQgaW4gZGVmYXVsdCBzY29wZSBvbmx5XHJcbiAgICAgICAgICAgIGlmIChtYXRjaFsxXSA9PT0gXCJCXCIgJiYgc2NvcGUgPT09IGRlZmF1bHRTY29wZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImludmFsaWQgZXNjYXBlIFwiICsgbWF0Y2hbMF0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge3Njb3BlOiBcImFsbFwifSk7XHJcblxyXG4vKiBFbXB0eSBjaGFyYWN0ZXIgY2xhc3M6IFtdIG9yIFteXVxyXG4gKiBGaXhlcyBhIGNyaXRpY2FsIGNyb3NzLWJyb3dzZXIgc3ludGF4IGluY29uc2lzdGVuY3kuIFVubGVzcyB0aGlzIGlzIHN0YW5kYXJkaXplZCAocGVyIHRoZSBzcGVjKSxcclxuICogcmVnZXggc3ludGF4IGNhbid0IGJlIGFjY3VyYXRlbHkgcGFyc2VkIGJlY2F1c2UgY2hhcmFjdGVyIGNsYXNzIGVuZGluZ3MgY2FuJ3QgYmUgZGV0ZXJtaW5lZC5cclxuICovXHJcbiAgICBhZGQoL1xcWyhcXF4/KV0vLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBGb3IgY3Jvc3MtYnJvd3NlciBjb21wYXRpYmlsaXR5IHdpdGggRVMzLCBjb252ZXJ0IFtdIHRvIFxcYlxcQiBhbmQgW15dIHRvIFtcXHNcXFNdLlxyXG4gICAgICAgICAgICAvLyAoPyEpIHNob3VsZCB3b3JrIGxpa2UgXFxiXFxCLCBidXQgaXMgdW5yZWxpYWJsZSBpbiBGaXJlZm94XHJcbiAgICAgICAgICAgIHJldHVybiBtYXRjaFsxXSA/IFwiW1xcXFxzXFxcXFNdXCIgOiBcIlxcXFxiXFxcXEJcIjtcclxuICAgICAgICB9KTtcclxuXHJcbi8qIENvbW1lbnQgcGF0dGVybjogKD8jIClcclxuICogSW5saW5lIGNvbW1lbnRzIGFyZSBhbiBhbHRlcm5hdGl2ZSB0byB0aGUgbGluZSBjb21tZW50cyBhbGxvd2VkIGluIGZyZWUtc3BhY2luZyBtb2RlIChmbGFnIHgpLlxyXG4gKi9cclxuICAgIGFkZCgvKD86XFwoXFw/I1teKV0qXFwpKSsvLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICAvLyBLZWVwIHRva2VucyBzZXBhcmF0ZWQgdW5sZXNzIHRoZSBmb2xsb3dpbmcgdG9rZW4gaXMgYSBxdWFudGlmaWVyXHJcbiAgICAgICAgICAgIHJldHVybiBuYXRpdi50ZXN0LmNhbGwocXVhbnRpZmllciwgbWF0Y2guaW5wdXQuc2xpY2UobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpKSA/IFwiXCIgOiBcIig/OilcIjtcclxuICAgICAgICB9KTtcclxuXHJcbi8qIE5hbWVkIGJhY2tyZWZlcmVuY2U6IFxcazxuYW1lPlxyXG4gKiBCYWNrcmVmZXJlbmNlIG5hbWVzIGNhbiB1c2UgdGhlIGNoYXJhY3RlcnMgQS1aLCBhLXosIDAtOSwgXywgYW5kICQgb25seS5cclxuICovXHJcbiAgICBhZGQoL1xcXFxrPChbXFx3JF0rKT4vLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBpc05hTihtYXRjaFsxXSkgPyAobGFzdEluZGV4T2YodGhpcy5jYXB0dXJlTmFtZXMsIG1hdGNoWzFdKSArIDEpIDogK21hdGNoWzFdLFxyXG4gICAgICAgICAgICAgICAgZW5kSW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcclxuICAgICAgICAgICAgaWYgKCFpbmRleCB8fCBpbmRleCA+IHRoaXMuY2FwdHVyZU5hbWVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiYmFja3JlZmVyZW5jZSB0byB1bmRlZmluZWQgZ3JvdXAgXCIgKyBtYXRjaFswXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gS2VlcCBiYWNrcmVmZXJlbmNlcyBzZXBhcmF0ZSBmcm9tIHN1YnNlcXVlbnQgbGl0ZXJhbCBudW1iZXJzXHJcbiAgICAgICAgICAgIHJldHVybiBcIlxcXFxcIiArIGluZGV4ICsgKFxyXG4gICAgICAgICAgICAgICAgZW5kSW5kZXggPT09IG1hdGNoLmlucHV0Lmxlbmd0aCB8fCBpc05hTihtYXRjaC5pbnB1dC5jaGFyQXQoZW5kSW5kZXgpKSA/IFwiXCIgOiBcIig/OilcIlxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0pO1xyXG5cclxuLyogV2hpdGVzcGFjZSBhbmQgbGluZSBjb21tZW50cywgaW4gZnJlZS1zcGFjaW5nIG1vZGUgKGFrYSBleHRlbmRlZCBtb2RlLCBmbGFnIHgpIG9ubHkuXHJcbiAqL1xyXG4gICAgYWRkKC8oPzpcXHMrfCMuKikrLyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgLy8gS2VlcCB0b2tlbnMgc2VwYXJhdGVkIHVubGVzcyB0aGUgZm9sbG93aW5nIHRva2VuIGlzIGEgcXVhbnRpZmllclxyXG4gICAgICAgICAgICByZXR1cm4gbmF0aXYudGVzdC5jYWxsKHF1YW50aWZpZXIsIG1hdGNoLmlucHV0LnNsaWNlKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKSkgPyBcIlwiIDogXCIoPzopXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHRyaWdnZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhhc0ZsYWcoXCJ4XCIpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjdXN0b21GbGFnczogXCJ4XCJcclxuICAgICAgICB9KTtcclxuXHJcbi8qIERvdCwgaW4gZG90YWxsIG1vZGUgKGFrYSBzaW5nbGVsaW5lIG1vZGUsIGZsYWcgcykgb25seS5cclxuICovXHJcbiAgICBhZGQoL1xcLi8sXHJcbiAgICAgICAgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJbXFxcXHNcXFxcU11cIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHJpZ2dlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFzRmxhZyhcInNcIik7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGN1c3RvbUZsYWdzOiBcInNcIlxyXG4gICAgICAgIH0pO1xyXG5cclxuLyogTmFtZWQgY2FwdHVyaW5nIGdyb3VwOyBtYXRjaCB0aGUgb3BlbmluZyBkZWxpbWl0ZXIgb25seTogKD88bmFtZT5cclxuICogQ2FwdHVyZSBuYW1lcyBjYW4gdXNlIHRoZSBjaGFyYWN0ZXJzIEEtWiwgYS16LCAwLTksIF8sIGFuZCAkIG9ubHkuIE5hbWVzIGNhbid0IGJlIGludGVnZXJzLlxyXG4gKiBTdXBwb3J0cyBQeXRob24tc3R5bGUgKD9QPG5hbWU+IGFzIGFuIGFsdGVybmF0ZSBzeW50YXggdG8gYXZvaWQgaXNzdWVzIGluIHJlY2VudCBPcGVyYSAod2hpY2hcclxuICogbmF0aXZlbHkgc3VwcG9ydHMgdGhlIFB5dGhvbi1zdHlsZSBzeW50YXgpLiBPdGhlcndpc2UsIFhSZWdFeHAgbWlnaHQgdHJlYXQgbnVtYmVyZWRcclxuICogYmFja3JlZmVyZW5jZXMgdG8gUHl0aG9uLXN0eWxlIG5hbWVkIGNhcHR1cmUgYXMgb2N0YWxzLlxyXG4gKi9cclxuICAgIGFkZCgvXFwoXFw/UD88KFtcXHckXSspPi8sXHJcbiAgICAgICAgZnVuY3Rpb24gKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGlmICghaXNOYU4obWF0Y2hbMV0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBBdm9pZCBpbmNvcnJlY3QgbG9va3Vwcywgc2luY2UgbmFtZWQgYmFja3JlZmVyZW5jZXMgYXJlIGFkZGVkIHRvIG1hdGNoIGFycmF5c1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiY2FuJ3QgdXNlIGludGVnZXIgYXMgY2FwdHVyZSBuYW1lIFwiICsgbWF0Y2hbMF0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY2FwdHVyZU5hbWVzLnB1c2gobWF0Y2hbMV0pO1xyXG4gICAgICAgICAgICB0aGlzLmhhc05hbWVkQ2FwdHVyZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybiBcIihcIjtcclxuICAgICAgICB9KTtcclxuXHJcbi8qIE51bWJlcmVkIGJhY2tyZWZlcmVuY2Ugb3Igb2N0YWwsIHBsdXMgYW55IGZvbGxvd2luZyBkaWdpdHM6IFxcMCwgXFwxMSwgZXRjLlxyXG4gKiBPY3RhbHMgZXhjZXB0IFxcMCBub3QgZm9sbG93ZWQgYnkgMC05IGFuZCBiYWNrcmVmZXJlbmNlcyB0byB1bm9wZW5lZCBjYXB0dXJlIGdyb3VwcyB0aHJvdyBhblxyXG4gKiBlcnJvci4gT3RoZXIgbWF0Y2hlcyBhcmUgcmV0dXJuZWQgdW5hbHRlcmVkLiBJRSA8PSA4IGRvZXNuJ3Qgc3VwcG9ydCBiYWNrcmVmZXJlbmNlcyBncmVhdGVyIHRoYW5cclxuICogXFw5OSBpbiByZWdleCBzeW50YXguXHJcbiAqL1xyXG4gICAgYWRkKC9cXFxcKFxcZCspLyxcclxuICAgICAgICBmdW5jdGlvbiAobWF0Y2gsIHNjb3BlKSB7XHJcbiAgICAgICAgICAgIGlmICghKHNjb3BlID09PSBkZWZhdWx0U2NvcGUgJiYgL15bMS05XS8udGVzdChtYXRjaFsxXSkgJiYgK21hdGNoWzFdIDw9IHRoaXMuY2FwdHVyZU5hbWVzLmxlbmd0aCkgJiZcclxuICAgICAgICAgICAgICAgICAgICBtYXRjaFsxXSAhPT0gXCIwXCIpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImNhbid0IHVzZSBvY3RhbCBlc2NhcGUgb3IgYmFja3JlZmVyZW5jZSB0byB1bmRlZmluZWQgZ3JvdXAgXCIgKyBtYXRjaFswXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG1hdGNoWzBdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge3Njb3BlOiBcImFsbFwifSk7XHJcblxyXG4vKiBDYXB0dXJpbmcgZ3JvdXA7IG1hdGNoIHRoZSBvcGVuaW5nIHBhcmVudGhlc2lzIG9ubHkuXHJcbiAqIFJlcXVpcmVkIGZvciBzdXBwb3J0IG9mIG5hbWVkIGNhcHR1cmluZyBncm91cHMuIEFsc28gYWRkcyBleHBsaWNpdCBjYXB0dXJlIG1vZGUgKGZsYWcgbikuXHJcbiAqL1xyXG4gICAgYWRkKC9cXCgoPyFcXD8pLyxcclxuICAgICAgICBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc0ZsYWcoXCJuXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIoPzpcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmNhcHR1cmVOYW1lcy5wdXNoKG51bGwpO1xyXG4gICAgICAgICAgICByZXR1cm4gXCIoXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7Y3VzdG9tRmxhZ3M6IFwiblwifSk7XHJcblxyXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBFeHBvc2UgWFJlZ0V4cFxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4vLyBGb3IgQ29tbW9uSlMgZW52aXJvbWVudHNcclxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgIGV4cG9ydHMuWFJlZ0V4cCA9IHNlbGY7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHNlbGY7XHJcblxyXG59KCkpO1xyXG5cclxuXG4vKioqKiogdW5pY29kZS1iYXNlLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCBVbmljb2RlIEJhc2UgdjEuMC4wXHJcbiAqIChjKSAyMDA4LTIwMTIgU3RldmVuIExldml0aGFuIDxodHRwOi8veHJlZ2V4cC5jb20vPlxyXG4gKiBNSVQgTGljZW5zZVxyXG4gKiBVc2VzIFVuaWNvZGUgNi4xIDxodHRwOi8vdW5pY29kZS5vcmcvPlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHN1cHBvcnQgZm9yIHRoZSBgXFxwe0x9YCBvciBgXFxwe0xldHRlcn1gIFVuaWNvZGUgY2F0ZWdvcnkuIEFkZG9uIHBhY2thZ2VzIGZvciBvdGhlciBVbmljb2RlXHJcbiAqIGNhdGVnb3JpZXMsIHNjcmlwdHMsIGJsb2NrcywgYW5kIHByb3BlcnRpZXMgYXJlIGF2YWlsYWJsZSBzZXBhcmF0ZWx5LiBBbGwgVW5pY29kZSB0b2tlbnMgY2FuIGJlXHJcbiAqIGludmVydGVkIHVzaW5nIGBcXFB7Li59YCBvciBgXFxwe14uLn1gLiBUb2tlbiBuYW1lcyBhcmUgY2FzZSBpbnNlbnNpdGl2ZSwgYW5kIGFueSBzcGFjZXMsIGh5cGhlbnMsXHJcbiAqIGFuZCB1bmRlcnNjb3JlcyBhcmUgaWdub3JlZC5cclxuICogQHJlcXVpcmVzIFhSZWdFeHBcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgdmFyIHVuaWNvZGUgPSB7fTtcclxuXHJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIFByaXZhdGUgaGVscGVyIGZ1bmN0aW9uc1xyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4vLyBHZW5lcmF0ZXMgYSBzdGFuZGFyZGl6ZWQgdG9rZW4gbmFtZSAobG93ZXJjYXNlLCB3aXRoIGh5cGhlbnMsIHNwYWNlcywgYW5kIHVuZGVyc2NvcmVzIHJlbW92ZWQpXHJcbiAgICBmdW5jdGlvbiBzbHVnKG5hbWUpIHtcclxuICAgICAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9bLSBfXSsvZywgXCJcIikudG9Mb3dlckNhc2UoKTtcclxuICAgIH1cclxuXHJcbi8vIEV4cGFuZHMgYSBsaXN0IG9mIFVuaWNvZGUgY29kZSBwb2ludHMgYW5kIHJhbmdlcyB0byBiZSB1c2FibGUgaW4gYSByZWdleCBjaGFyYWN0ZXIgY2xhc3NcclxuICAgIGZ1bmN0aW9uIGV4cGFuZChzdHIpIHtcclxuICAgICAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xcd3s0fS9nLCBcIlxcXFx1JCZcIik7XHJcbiAgICB9XHJcblxyXG4vLyBBZGRzIGxlYWRpbmcgemVyb3MgaWYgc2hvcnRlciB0aGFuIGZvdXIgY2hhcmFjdGVyc1xyXG4gICAgZnVuY3Rpb24gcGFkNChzdHIpIHtcclxuICAgICAgICB3aGlsZSAoc3RyLmxlbmd0aCA8IDQpIHtcclxuICAgICAgICAgICAgc3RyID0gXCIwXCIgKyBzdHI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdHI7XHJcbiAgICB9XHJcblxyXG4vLyBDb252ZXJ0cyBhIGhleGFkZWNpbWFsIG51bWJlciB0byBkZWNpbWFsXHJcbiAgICBmdW5jdGlvbiBkZWMoaGV4KSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KGhleCwgMTYpO1xyXG4gICAgfVxyXG5cclxuLy8gQ29udmVydHMgYSBkZWNpbWFsIG51bWJlciB0byBoZXhhZGVjaW1hbFxyXG4gICAgZnVuY3Rpb24gaGV4KGRlYykge1xyXG4gICAgICAgIHJldHVybiBwYXJzZUludChkZWMsIDEwKS50b1N0cmluZygxNik7XHJcbiAgICB9XHJcblxyXG4vLyBJbnZlcnRzIGEgbGlzdCBvZiBVbmljb2RlIGNvZGUgcG9pbnRzIGFuZCByYW5nZXNcclxuICAgIGZ1bmN0aW9uIGludmVydChyYW5nZSkge1xyXG4gICAgICAgIHZhciBvdXRwdXQgPSBbXSxcclxuICAgICAgICAgICAgbGFzdEVuZCA9IC0xLFxyXG4gICAgICAgICAgICBzdGFydDtcclxuICAgICAgICBYUmVnRXhwLmZvckVhY2gocmFuZ2UsIC9cXFxcdShcXHd7NH0pKD86LVxcXFx1KFxcd3s0fSkpPy8sIGZ1bmN0aW9uIChtKSB7XHJcbiAgICAgICAgICAgIHN0YXJ0ID0gZGVjKG1bMV0pO1xyXG4gICAgICAgICAgICBpZiAoc3RhcnQgPiAobGFzdEVuZCArIDEpKSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChcIlxcXFx1XCIgKyBwYWQ0KGhleChsYXN0RW5kICsgMSkpKTtcclxuICAgICAgICAgICAgICAgIGlmIChzdGFydCA+IChsYXN0RW5kICsgMikpIHtcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChcIi1cXFxcdVwiICsgcGFkNChoZXgoc3RhcnQgLSAxKSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxhc3RFbmQgPSBkZWMobVsyXSB8fCBtWzFdKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAobGFzdEVuZCA8IDB4RkZGRikge1xyXG4gICAgICAgICAgICBvdXRwdXQucHVzaChcIlxcXFx1XCIgKyBwYWQ0KGhleChsYXN0RW5kICsgMSkpKTtcclxuICAgICAgICAgICAgaWYgKGxhc3RFbmQgPCAweEZGRkUpIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKFwiLVxcXFx1RkZGRlwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb3V0cHV0LmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4vLyBHZW5lcmF0ZXMgYW4gaW52ZXJ0ZWQgdG9rZW4gb24gZmlyc3QgdXNlXHJcbiAgICBmdW5jdGlvbiBjYWNoZUludmVyc2lvbihpdGVtKSB7XHJcbiAgICAgICAgcmV0dXJuIHVuaWNvZGVbXCJeXCIgKyBpdGVtXSB8fCAodW5pY29kZVtcIl5cIiArIGl0ZW1dID0gaW52ZXJ0KHVuaWNvZGVbaXRlbV0pKTtcclxuICAgIH1cclxuXHJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcmUgZnVuY3Rpb25hbGl0eVxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgWFJlZ0V4cC5pbnN0YWxsKFwiZXh0ZW5zaWJpbGl0eVwiKTtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIHRvIHRoZSBsaXN0IG9mIFVuaWNvZGUgcHJvcGVydGllcyB0aGF0IFhSZWdFeHAgcmVnZXhlcyBjYW4gbWF0Y2ggdmlhIFxccHsuLn0gb3IgXFxQey4ufS5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtPYmplY3R9IHBhY2sgTmFtZWQgc2V0cyBvZiBVbmljb2RlIGNvZGUgcG9pbnRzIGFuZCByYW5nZXMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbYWxpYXNlc10gQWxpYXNlcyBmb3IgdGhlIHByaW1hcnkgdG9rZW4gbmFtZXMuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2Uoe1xyXG4gKiAgIFhEaWdpdDogJzAwMzAtMDAzOTAwNDEtMDA0NjAwNjEtMDA2NicgLy8gMC05QS1GYS1mXHJcbiAqIH0sIHtcclxuICogICBYRGlnaXQ6ICdIZXhhZGVjaW1hbCdcclxuICogfSk7XHJcbiAqL1xyXG4gICAgWFJlZ0V4cC5hZGRVbmljb2RlUGFja2FnZSA9IGZ1bmN0aW9uIChwYWNrLCBhbGlhc2VzKSB7XHJcbiAgICAgICAgdmFyIHA7XHJcbiAgICAgICAgaWYgKCFYUmVnRXhwLmlzSW5zdGFsbGVkKFwiZXh0ZW5zaWJpbGl0eVwiKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleHRlbnNpYmlsaXR5IG11c3QgYmUgaW5zdGFsbGVkIGJlZm9yZSBhZGRpbmcgVW5pY29kZSBwYWNrYWdlc1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHBhY2spIHtcclxuICAgICAgICAgICAgZm9yIChwIGluIHBhY2spIHtcclxuICAgICAgICAgICAgICAgIGlmIChwYWNrLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdW5pY29kZVtzbHVnKHApXSA9IGV4cGFuZChwYWNrW3BdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYWxpYXNlcykge1xyXG4gICAgICAgICAgICBmb3IgKHAgaW4gYWxpYXNlcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGFsaWFzZXMuaGFzT3duUHJvcGVydHkocCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB1bmljb2RlW3NsdWcoYWxpYXNlc1twXSldID0gdW5pY29kZVtzbHVnKHApXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4vKiBBZGRzIGRhdGEgZm9yIHRoZSBVbmljb2RlIGBMZXR0ZXJgIGNhdGVnb3J5LiBBZGRvbiBwYWNrYWdlcyBpbmNsdWRlIG90aGVyIGNhdGVnb3JpZXMsIHNjcmlwdHMsXHJcbiAqIGJsb2NrcywgYW5kIHByb3BlcnRpZXMuXHJcbiAqL1xyXG4gICAgWFJlZ0V4cC5hZGRVbmljb2RlUGFja2FnZSh7XHJcbiAgICAgICAgTDogXCIwMDQxLTAwNUEwMDYxLTAwN0EwMEFBMDBCNTAwQkEwMEMwLTAwRDYwMEQ4LTAwRjYwMEY4LTAyQzEwMkM2LTAyRDEwMkUwLTAyRTQwMkVDMDJFRTAzNzAtMDM3NDAzNzYwMzc3MDM3QS0wMzdEMDM4NjAzODgtMDM4QTAzOEMwMzhFLTAzQTEwM0EzLTAzRjUwM0Y3LTA0ODEwNDhBLTA1MjcwNTMxLTA1NTYwNTU5MDU2MS0wNTg3MDVEMC0wNUVBMDVGMC0wNUYyMDYyMC0wNjRBMDY2RTA2NkYwNjcxLTA2RDMwNkQ1MDZFNTA2RTYwNkVFMDZFRjA2RkEtMDZGQzA2RkYwNzEwMDcxMi0wNzJGMDc0RC0wN0E1MDdCMTA3Q0EtMDdFQTA3RjQwN0Y1MDdGQTA4MDAtMDgxNTA4MUEwODI0MDgyODA4NDAtMDg1ODA4QTAwOEEyLTA4QUMwOTA0LTA5MzkwOTNEMDk1MDA5NTgtMDk2MTA5NzEtMDk3NzA5NzktMDk3RjA5ODUtMDk4QzA5OEYwOTkwMDk5My0wOUE4MDlBQS0wOUIwMDlCMjA5QjYtMDlCOTA5QkQwOUNFMDlEQzA5REQwOURGLTA5RTEwOUYwMDlGMTBBMDUtMEEwQTBBMEYwQTEwMEExMy0wQTI4MEEyQS0wQTMwMEEzMjBBMzMwQTM1MEEzNjBBMzgwQTM5MEE1OS0wQTVDMEE1RTBBNzItMEE3NDBBODUtMEE4RDBBOEYtMEE5MTBBOTMtMEFBODBBQUEtMEFCMDBBQjIwQUIzMEFCNS0wQUI5MEFCRDBBRDAwQUUwMEFFMTBCMDUtMEIwQzBCMEYwQjEwMEIxMy0wQjI4MEIyQS0wQjMwMEIzMjBCMzMwQjM1LTBCMzkwQjNEMEI1QzBCNUQwQjVGLTBCNjEwQjcxMEI4MzBCODUtMEI4QTBCOEUtMEI5MDBCOTItMEI5NTBCOTkwQjlBMEI5QzBCOUUwQjlGMEJBMzBCQTQwQkE4LTBCQUEwQkFFLTBCQjkwQkQwMEMwNS0wQzBDMEMwRS0wQzEwMEMxMi0wQzI4MEMyQS0wQzMzMEMzNS0wQzM5MEMzRDBDNTgwQzU5MEM2MDBDNjEwQzg1LTBDOEMwQzhFLTBDOTAwQzkyLTBDQTgwQ0FBLTBDQjMwQ0I1LTBDQjkwQ0JEMENERTBDRTAwQ0UxMENGMTBDRjIwRDA1LTBEMEMwRDBFLTBEMTAwRDEyLTBEM0EwRDNEMEQ0RTBENjAwRDYxMEQ3QS0wRDdGMEQ4NS0wRDk2MEQ5QS0wREIxMERCMy0wREJCMERCRDBEQzAtMERDNjBFMDEtMEUzMDBFMzIwRTMzMEU0MC0wRTQ2MEU4MTBFODIwRTg0MEU4NzBFODgwRThBMEU4RDBFOTQtMEU5NzBFOTktMEU5RjBFQTEtMEVBMzBFQTUwRUE3MEVBQTBFQUIwRUFELTBFQjAwRUIyMEVCMzBFQkQwRUMwLTBFQzQwRUM2MEVEQy0wRURGMEYwMDBGNDAtMEY0NzBGNDktMEY2QzBGODgtMEY4QzEwMDAtMTAyQTEwM0YxMDUwLTEwNTUxMDVBLTEwNUQxMDYxMTA2NTEwNjYxMDZFLTEwNzAxMDc1LTEwODExMDhFMTBBMC0xMEM1MTBDNzEwQ0QxMEQwLTEwRkExMEZDLTEyNDgxMjRBLTEyNEQxMjUwLTEyNTYxMjU4MTI1QS0xMjVEMTI2MC0xMjg4MTI4QS0xMjhEMTI5MC0xMkIwMTJCMi0xMkI1MTJCOC0xMkJFMTJDMDEyQzItMTJDNTEyQzgtMTJENjEyRDgtMTMxMDEzMTItMTMxNTEzMTgtMTM1QTEzODAtMTM4RjEzQTAtMTNGNDE0MDEtMTY2QzE2NkYtMTY3RjE2ODEtMTY5QTE2QTAtMTZFQTE3MDAtMTcwQzE3MEUtMTcxMTE3MjAtMTczMTE3NDAtMTc1MTE3NjAtMTc2QzE3NkUtMTc3MDE3ODAtMTdCMzE3RDcxN0RDMTgyMC0xODc3MTg4MC0xOEE4MThBQTE4QjAtMThGNTE5MDAtMTkxQzE5NTAtMTk2RDE5NzAtMTk3NDE5ODAtMTlBQjE5QzEtMTlDNzFBMDAtMUExNjFBMjAtMUE1NDFBQTcxQjA1LTFCMzMxQjQ1LTFCNEIxQjgzLTFCQTAxQkFFMUJBRjFCQkEtMUJFNTFDMDAtMUMyMzFDNEQtMUM0RjFDNUEtMUM3RDFDRTktMUNFQzFDRUUtMUNGMTFDRjUxQ0Y2MUQwMC0xREJGMUUwMC0xRjE1MUYxOC0xRjFEMUYyMC0xRjQ1MUY0OC0xRjREMUY1MC0xRjU3MUY1OTFGNUIxRjVEMUY1Ri0xRjdEMUY4MC0xRkI0MUZCNi0xRkJDMUZCRTFGQzItMUZDNDFGQzYtMUZDQzFGRDAtMUZEMzFGRDYtMUZEQjFGRTAtMUZFQzFGRjItMUZGNDFGRjYtMUZGQzIwNzEyMDdGMjA5MC0yMDlDMjEwMjIxMDcyMTBBLTIxMTMyMTE1MjExOS0yMTFEMjEyNDIxMjYyMTI4MjEyQS0yMTJEMjEyRi0yMTM5MjEzQy0yMTNGMjE0NS0yMTQ5MjE0RTIxODMyMTg0MkMwMC0yQzJFMkMzMC0yQzVFMkM2MC0yQ0U0MkNFQi0yQ0VFMkNGMjJDRjMyRDAwLTJEMjUyRDI3MkQyRDJEMzAtMkQ2NzJENkYyRDgwLTJEOTYyREEwLTJEQTYyREE4LTJEQUUyREIwLTJEQjYyREI4LTJEQkUyREMwLTJEQzYyREM4LTJEQ0UyREQwLTJERDYyREQ4LTJEREUyRTJGMzAwNTMwMDYzMDMxLTMwMzUzMDNCMzAzQzMwNDEtMzA5NjMwOUQtMzA5RjMwQTEtMzBGQTMwRkMtMzBGRjMxMDUtMzEyRDMxMzEtMzE4RTMxQTAtMzFCQTMxRjAtMzFGRjM0MDAtNERCNTRFMDAtOUZDQ0EwMDAtQTQ4Q0E0RDAtQTRGREE1MDAtQTYwQ0E2MTAtQTYxRkE2MkFBNjJCQTY0MC1BNjZFQTY3Ri1BNjk3QTZBMC1BNkU1QTcxNy1BNzFGQTcyMi1BNzg4QTc4Qi1BNzhFQTc5MC1BNzkzQTdBMC1BN0FBQTdGOC1BODAxQTgwMy1BODA1QTgwNy1BODBBQTgwQy1BODIyQTg0MC1BODczQTg4Mi1BOEIzQThGMi1BOEY3QThGQkE5MEEtQTkyNUE5MzAtQTk0NkE5NjAtQTk3Q0E5ODQtQTlCMkE5Q0ZBQTAwLUFBMjhBQTQwLUFBNDJBQTQ0LUFBNEJBQTYwLUFBNzZBQTdBQUE4MC1BQUFGQUFCMUFBQjVBQUI2QUFCOS1BQUJEQUFDMEFBQzJBQURCLUFBRERBQUUwLUFBRUFBQUYyLUFBRjRBQjAxLUFCMDZBQjA5LUFCMEVBQjExLUFCMTZBQjIwLUFCMjZBQjI4LUFCMkVBQkMwLUFCRTJBQzAwLUQ3QTNEN0IwLUQ3QzZEN0NCLUQ3RkJGOTAwLUZBNkRGQTcwLUZBRDlGQjAwLUZCMDZGQjEzLUZCMTdGQjFERkIxRi1GQjI4RkIyQS1GQjM2RkIzOC1GQjNDRkIzRUZCNDBGQjQxRkI0M0ZCNDRGQjQ2LUZCQjFGQkQzLUZEM0RGRDUwLUZEOEZGRDkyLUZEQzdGREYwLUZERkJGRTcwLUZFNzRGRTc2LUZFRkNGRjIxLUZGM0FGRjQxLUZGNUFGRjY2LUZGQkVGRkMyLUZGQzdGRkNBLUZGQ0ZGRkQyLUZGRDdGRkRBLUZGRENcIlxyXG4gICAgfSwge1xyXG4gICAgICAgIEw6IFwiTGV0dGVyXCJcclxuICAgIH0pO1xyXG5cclxuLyogQWRkcyBVbmljb2RlIHByb3BlcnR5IHN5bnRheCB0byBYUmVnRXhwOiBcXHB7Li59LCBcXFB7Li59LCBcXHB7Xi4ufVxyXG4gKi9cclxuICAgIFhSZWdFeHAuYWRkVG9rZW4oXHJcbiAgICAgICAgL1xcXFwoW3BQXSl7KFxcXj8pKFtefV0qKX0vLFxyXG4gICAgICAgIGZ1bmN0aW9uIChtYXRjaCwgc2NvcGUpIHtcclxuICAgICAgICAgICAgdmFyIGludiA9IChtYXRjaFsxXSA9PT0gXCJQXCIgfHwgbWF0Y2hbMl0pID8gXCJeXCIgOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgaXRlbSA9IHNsdWcobWF0Y2hbM10pO1xyXG4gICAgICAgICAgICAvLyBUaGUgZG91YmxlIG5lZ2F0aXZlIFxcUHteLi59IGlzIGludmFsaWRcclxuICAgICAgICAgICAgaWYgKG1hdGNoWzFdID09PSBcIlBcIiAmJiBtYXRjaFsyXSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiaW52YWxpZCBkb3VibGUgbmVnYXRpb24gXFxcXFB7XlwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIXVuaWNvZGUuaGFzT3duUHJvcGVydHkoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImludmFsaWQgb3IgdW5rbm93biBVbmljb2RlIHByb3BlcnR5IFwiICsgbWF0Y2hbMF0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBzY29wZSA9PT0gXCJjbGFzc1wiID9cclxuICAgICAgICAgICAgICAgICAgICAoaW52ID8gY2FjaGVJbnZlcnNpb24oaXRlbSkgOiB1bmljb2RlW2l0ZW1dKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgXCJbXCIgKyBpbnYgKyB1bmljb2RlW2l0ZW1dICsgXCJdXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7c2NvcGU6IFwiYWxsXCJ9XHJcbiAgICApO1xyXG5cclxufShYUmVnRXhwKSk7XHJcblxyXG5cbi8qKioqKiB1bmljb2RlLWNhdGVnb3JpZXMuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwIFVuaWNvZGUgQ2F0ZWdvcmllcyB2MS4yLjBcclxuICogKGMpIDIwMTAtMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqIFVzZXMgVW5pY29kZSA2LjEgPGh0dHA6Ly91bmljb2RlLm9yZy8+XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgc3VwcG9ydCBmb3IgYWxsIFVuaWNvZGUgY2F0ZWdvcmllcyAoYWthIHByb3BlcnRpZXMpIEUuZy4sIGBcXHB7THV9YCBvclxyXG4gKiBgXFxwe1VwcGVyY2FzZSBMZXR0ZXJ9YC4gVG9rZW4gbmFtZXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBhbnkgc3BhY2VzLCBoeXBoZW5zLCBhbmRcclxuICogdW5kZXJzY29yZXMgYXJlIGlnbm9yZWQuXHJcbiAqIEByZXF1aXJlcyBYUmVnRXhwLCBYUmVnRXhwIFVuaWNvZGUgQmFzZVxyXG4gKi9cclxuKGZ1bmN0aW9uIChYUmVnRXhwKSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICBpZiAoIVhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2UpIHtcclxuICAgICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJVbmljb2RlIEJhc2UgbXVzdCBiZSBsb2FkZWQgYmVmb3JlIFVuaWNvZGUgQ2F0ZWdvcmllc1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBYUmVnRXhwLmluc3RhbGwoXCJleHRlbnNpYmlsaXR5XCIpO1xyXG5cclxuICAgIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2Uoe1xyXG4gICAgICAgIC8vTDogXCJcIiwgLy8gSW5jbHVkZWQgaW4gdGhlIFVuaWNvZGUgQmFzZSBhZGRvblxyXG4gICAgICAgIExsOiBcIjAwNjEtMDA3QTAwQjUwMERGLTAwRjYwMEY4LTAwRkYwMTAxMDEwMzAxMDUwMTA3MDEwOTAxMEIwMTBEMDEwRjAxMTEwMTEzMDExNTAxMTcwMTE5MDExQjAxMUQwMTFGMDEyMTAxMjMwMTI1MDEyNzAxMjkwMTJCMDEyRDAxMkYwMTMxMDEzMzAxMzUwMTM3MDEzODAxM0EwMTNDMDEzRTAxNDAwMTQyMDE0NDAxNDYwMTQ4MDE0OTAxNEIwMTREMDE0RjAxNTEwMTUzMDE1NTAxNTcwMTU5MDE1QjAxNUQwMTVGMDE2MTAxNjMwMTY1MDE2NzAxNjkwMTZCMDE2RDAxNkYwMTcxMDE3MzAxNzUwMTc3MDE3QTAxN0MwMTdFLTAxODAwMTgzMDE4NTAxODgwMThDMDE4RDAxOTIwMTk1MDE5OS0wMTlCMDE5RTAxQTEwMUEzMDFBNTAxQTgwMUFBMDFBQjAxQUQwMUIwMDFCNDAxQjYwMUI5MDFCQTAxQkQtMDFCRjAxQzYwMUM5MDFDQzAxQ0UwMUQwMDFEMjAxRDQwMUQ2MDFEODAxREEwMURDMDFERDAxREYwMUUxMDFFMzAxRTUwMUU3MDFFOTAxRUIwMUVEMDFFRjAxRjAwMUYzMDFGNTAxRjkwMUZCMDFGRDAxRkYwMjAxMDIwMzAyMDUwMjA3MDIwOTAyMEIwMjBEMDIwRjAyMTEwMjEzMDIxNTAyMTcwMjE5MDIxQjAyMUQwMjFGMDIyMTAyMjMwMjI1MDIyNzAyMjkwMjJCMDIyRDAyMkYwMjMxMDIzMy0wMjM5MDIzQzAyM0YwMjQwMDI0MjAyNDcwMjQ5MDI0QjAyNEQwMjRGLTAyOTMwMjk1LTAyQUYwMzcxMDM3MzAzNzcwMzdCLTAzN0QwMzkwMDNBQy0wM0NFMDNEMDAzRDEwM0Q1LTAzRDcwM0Q5MDNEQjAzREQwM0RGMDNFMTAzRTMwM0U1MDNFNzAzRTkwM0VCMDNFRDAzRUYtMDNGMzAzRjUwM0Y4MDNGQjAzRkMwNDMwLTA0NUYwNDYxMDQ2MzA0NjUwNDY3MDQ2OTA0NkIwNDZEMDQ2RjA0NzEwNDczMDQ3NTA0NzcwNDc5MDQ3QjA0N0QwNDdGMDQ4MTA0OEIwNDhEMDQ4RjA0OTEwNDkzMDQ5NTA0OTcwNDk5MDQ5QjA0OUQwNDlGMDRBMTA0QTMwNEE1MDRBNzA0QTkwNEFCMDRBRDA0QUYwNEIxMDRCMzA0QjUwNEI3MDRCOTA0QkIwNEJEMDRCRjA0QzIwNEM0MDRDNjA0QzgwNENBMDRDQzA0Q0UwNENGMDREMTA0RDMwNEQ1MDRENzA0RDkwNERCMDRERDA0REYwNEUxMDRFMzA0RTUwNEU3MDRFOTA0RUIwNEVEMDRFRjA0RjEwNEYzMDRGNTA0RjcwNEY5MDRGQjA0RkQwNEZGMDUwMTA1MDMwNTA1MDUwNzA1MDkwNTBCMDUwRDA1MEYwNTExMDUxMzA1MTUwNTE3MDUxOTA1MUIwNTFEMDUxRjA1MjEwNTIzMDUyNTA1MjcwNTYxLTA1ODcxRDAwLTFEMkIxRDZCLTFENzcxRDc5LTFEOUExRTAxMUUwMzFFMDUxRTA3MUUwOTFFMEIxRTBEMUUwRjFFMTExRTEzMUUxNTFFMTcxRTE5MUUxQjFFMUQxRTFGMUUyMTFFMjMxRTI1MUUyNzFFMjkxRTJCMUUyRDFFMkYxRTMxMUUzMzFFMzUxRTM3MUUzOTFFM0IxRTNEMUUzRjFFNDExRTQzMUU0NTFFNDcxRTQ5MUU0QjFFNEQxRTRGMUU1MTFFNTMxRTU1MUU1NzFFNTkxRTVCMUU1RDFFNUYxRTYxMUU2MzFFNjUxRTY3MUU2OTFFNkIxRTZEMUU2RjFFNzExRTczMUU3NTFFNzcxRTc5MUU3QjFFN0QxRTdGMUU4MTFFODMxRTg1MUU4NzFFODkxRThCMUU4RDFFOEYxRTkxMUU5MzFFOTUtMUU5RDFFOUYxRUExMUVBMzFFQTUxRUE3MUVBOTFFQUIxRUFEMUVBRjFFQjExRUIzMUVCNTFFQjcxRUI5MUVCQjFFQkQxRUJGMUVDMTFFQzMxRUM1MUVDNzFFQzkxRUNCMUVDRDFFQ0YxRUQxMUVEMzFFRDUxRUQ3MUVEOTFFREIxRUREMUVERjFFRTExRUUzMUVFNTFFRTcxRUU5MUVFQjFFRUQxRUVGMUVGMTFFRjMxRUY1MUVGNzFFRjkxRUZCMUVGRDFFRkYtMUYwNzFGMTAtMUYxNTFGMjAtMUYyNzFGMzAtMUYzNzFGNDAtMUY0NTFGNTAtMUY1NzFGNjAtMUY2NzFGNzAtMUY3RDFGODAtMUY4NzFGOTAtMUY5NzFGQTAtMUZBNzFGQjAtMUZCNDFGQjYxRkI3MUZCRTFGQzItMUZDNDFGQzYxRkM3MUZEMC0xRkQzMUZENjFGRDcxRkUwLTFGRTcxRkYyLTFGRjQxRkY2MUZGNzIxMEEyMTBFMjEwRjIxMTMyMTJGMjEzNDIxMzkyMTNDMjEzRDIxNDYtMjE0OTIxNEUyMTg0MkMzMC0yQzVFMkM2MTJDNjUyQzY2MkM2ODJDNkEyQzZDMkM3MTJDNzMyQzc0MkM3Ni0yQzdCMkM4MTJDODMyQzg1MkM4NzJDODkyQzhCMkM4RDJDOEYyQzkxMkM5MzJDOTUyQzk3MkM5OTJDOUIyQzlEMkM5RjJDQTEyQ0EzMkNBNTJDQTcyQ0E5MkNBQjJDQUQyQ0FGMkNCMTJDQjMyQ0I1MkNCNzJDQjkyQ0JCMkNCRDJDQkYyQ0MxMkNDMzJDQzUyQ0M3MkNDOTJDQ0IyQ0NEMkNDRjJDRDEyQ0QzMkNENTJDRDcyQ0Q5MkNEQjJDREQyQ0RGMkNFMTJDRTMyQ0U0MkNFQzJDRUUyQ0YzMkQwMC0yRDI1MkQyNzJEMkRBNjQxQTY0M0E2NDVBNjQ3QTY0OUE2NEJBNjREQTY0RkE2NTFBNjUzQTY1NUE2NTdBNjU5QTY1QkE2NURBNjVGQTY2MUE2NjNBNjY1QTY2N0E2NjlBNjZCQTY2REE2ODFBNjgzQTY4NUE2ODdBNjg5QTY4QkE2OERBNjhGQTY5MUE2OTNBNjk1QTY5N0E3MjNBNzI1QTcyN0E3MjlBNzJCQTcyREE3MkYtQTczMUE3MzNBNzM1QTczN0E3MzlBNzNCQTczREE3M0ZBNzQxQTc0M0E3NDVBNzQ3QTc0OUE3NEJBNzREQTc0RkE3NTFBNzUzQTc1NUE3NTdBNzU5QTc1QkE3NURBNzVGQTc2MUE3NjNBNzY1QTc2N0E3NjlBNzZCQTc2REE3NkZBNzcxLUE3NzhBNzdBQTc3Q0E3N0ZBNzgxQTc4M0E3ODVBNzg3QTc4Q0E3OEVBNzkxQTc5M0E3QTFBN0EzQTdBNUE3QTdBN0E5QTdGQUZCMDAtRkIwNkZCMTMtRkIxN0ZGNDEtRkY1QVwiLFxyXG4gICAgICAgIEx1OiBcIjAwNDEtMDA1QTAwQzAtMDBENjAwRDgtMDBERTAxMDAwMTAyMDEwNDAxMDYwMTA4MDEwQTAxMEMwMTBFMDExMDAxMTIwMTE0MDExNjAxMTgwMTFBMDExQzAxMUUwMTIwMDEyMjAxMjQwMTI2MDEyODAxMkEwMTJDMDEyRTAxMzAwMTMyMDEzNDAxMzYwMTM5MDEzQjAxM0QwMTNGMDE0MTAxNDMwMTQ1MDE0NzAxNEEwMTRDMDE0RTAxNTAwMTUyMDE1NDAxNTYwMTU4MDE1QTAxNUMwMTVFMDE2MDAxNjIwMTY0MDE2NjAxNjgwMTZBMDE2QzAxNkUwMTcwMDE3MjAxNzQwMTc2MDE3ODAxNzkwMTdCMDE3RDAxODEwMTgyMDE4NDAxODYwMTg3MDE4OS0wMThCMDE4RS0wMTkxMDE5MzAxOTQwMTk2LTAxOTgwMTlDMDE5RDAxOUYwMUEwMDFBMjAxQTQwMUE2MDFBNzAxQTkwMUFDMDFBRTAxQUYwMUIxLTAxQjMwMUI1MDFCNzAxQjgwMUJDMDFDNDAxQzcwMUNBMDFDRDAxQ0YwMUQxMDFEMzAxRDUwMUQ3MDFEOTAxREIwMURFMDFFMDAxRTIwMUU0MDFFNjAxRTgwMUVBMDFFQzAxRUUwMUYxMDFGNDAxRjYtMDFGODAxRkEwMUZDMDFGRTAyMDAwMjAyMDIwNDAyMDYwMjA4MDIwQTAyMEMwMjBFMDIxMDAyMTIwMjE0MDIxNjAyMTgwMjFBMDIxQzAyMUUwMjIwMDIyMjAyMjQwMjI2MDIyODAyMkEwMjJDMDIyRTAyMzAwMjMyMDIzQTAyM0IwMjNEMDIzRTAyNDEwMjQzLTAyNDYwMjQ4MDI0QTAyNEMwMjRFMDM3MDAzNzIwMzc2MDM4NjAzODgtMDM4QTAzOEMwMzhFMDM4RjAzOTEtMDNBMTAzQTMtMDNBQjAzQ0YwM0QyLTAzRDQwM0Q4MDNEQTAzREMwM0RFMDNFMDAzRTIwM0U0MDNFNjAzRTgwM0VBMDNFQzAzRUUwM0Y0MDNGNzAzRjkwM0ZBMDNGRC0wNDJGMDQ2MDA0NjIwNDY0MDQ2NjA0NjgwNDZBMDQ2QzA0NkUwNDcwMDQ3MjA0NzQwNDc2MDQ3ODA0N0EwNDdDMDQ3RTA0ODAwNDhBMDQ4QzA0OEUwNDkwMDQ5MjA0OTQwNDk2MDQ5ODA0OUEwNDlDMDQ5RTA0QTAwNEEyMDRBNDA0QTYwNEE4MDRBQTA0QUMwNEFFMDRCMDA0QjIwNEI0MDRCNjA0QjgwNEJBMDRCQzA0QkUwNEMwMDRDMTA0QzMwNEM1MDRDNzA0QzkwNENCMDRDRDA0RDAwNEQyMDRENDA0RDYwNEQ4MDREQTA0REMwNERFMDRFMDA0RTIwNEU0MDRFNjA0RTgwNEVBMDRFQzA0RUUwNEYwMDRGMjA0RjQwNEY2MDRGODA0RkEwNEZDMDRGRTA1MDAwNTAyMDUwNDA1MDYwNTA4MDUwQTA1MEMwNTBFMDUxMDA1MTIwNTE0MDUxNjA1MTgwNTFBMDUxQzA1MUUwNTIwMDUyMjA1MjQwNTI2MDUzMS0wNTU2MTBBMC0xMEM1MTBDNzEwQ0QxRTAwMUUwMjFFMDQxRTA2MUUwODFFMEExRTBDMUUwRTFFMTAxRTEyMUUxNDFFMTYxRTE4MUUxQTFFMUMxRTFFMUUyMDFFMjIxRTI0MUUyNjFFMjgxRTJBMUUyQzFFMkUxRTMwMUUzMjFFMzQxRTM2MUUzODFFM0ExRTNDMUUzRTFFNDAxRTQyMUU0NDFFNDYxRTQ4MUU0QTFFNEMxRTRFMUU1MDFFNTIxRTU0MUU1NjFFNTgxRTVBMUU1QzFFNUUxRTYwMUU2MjFFNjQxRTY2MUU2ODFFNkExRTZDMUU2RTFFNzAxRTcyMUU3NDFFNzYxRTc4MUU3QTFFN0MxRTdFMUU4MDFFODIxRTg0MUU4NjFFODgxRThBMUU4QzFFOEUxRTkwMUU5MjFFOTQxRTlFMUVBMDFFQTIxRUE0MUVBNjFFQTgxRUFBMUVBQzFFQUUxRUIwMUVCMjFFQjQxRUI2MUVCODFFQkExRUJDMUVCRTFFQzAxRUMyMUVDNDFFQzYxRUM4MUVDQTFFQ0MxRUNFMUVEMDFFRDIxRUQ0MUVENjFFRDgxRURBMUVEQzFFREUxRUUwMUVFMjFFRTQxRUU2MUVFODFFRUExRUVDMUVFRTFFRjAxRUYyMUVGNDFFRjYxRUY4MUVGQTFFRkMxRUZFMUYwOC0xRjBGMUYxOC0xRjFEMUYyOC0xRjJGMUYzOC0xRjNGMUY0OC0xRjREMUY1OTFGNUIxRjVEMUY1RjFGNjgtMUY2RjFGQjgtMUZCQjFGQzgtMUZDQjFGRDgtMUZEQjFGRTgtMUZFQzFGRjgtMUZGQjIxMDIyMTA3MjEwQi0yMTBEMjExMC0yMTEyMjExNTIxMTktMjExRDIxMjQyMTI2MjEyODIxMkEtMjEyRDIxMzAtMjEzMzIxM0UyMTNGMjE0NTIxODMyQzAwLTJDMkUyQzYwMkM2Mi0yQzY0MkM2NzJDNjkyQzZCMkM2RC0yQzcwMkM3MjJDNzUyQzdFLTJDODAyQzgyMkM4NDJDODYyQzg4MkM4QTJDOEMyQzhFMkM5MDJDOTIyQzk0MkM5NjJDOTgyQzlBMkM5QzJDOUUyQ0EwMkNBMjJDQTQyQ0E2MkNBODJDQUEyQ0FDMkNBRTJDQjAyQ0IyMkNCNDJDQjYyQ0I4MkNCQTJDQkMyQ0JFMkNDMDJDQzIyQ0M0MkNDNjJDQzgyQ0NBMkNDQzJDQ0UyQ0QwMkNEMjJDRDQyQ0Q2MkNEODJDREEyQ0RDMkNERTJDRTAyQ0UyMkNFQjJDRUQyQ0YyQTY0MEE2NDJBNjQ0QTY0NkE2NDhBNjRBQTY0Q0E2NEVBNjUwQTY1MkE2NTRBNjU2QTY1OEE2NUFBNjVDQTY1RUE2NjBBNjYyQTY2NEE2NjZBNjY4QTY2QUE2NkNBNjgwQTY4MkE2ODRBNjg2QTY4OEE2OEFBNjhDQTY4RUE2OTBBNjkyQTY5NEE2OTZBNzIyQTcyNEE3MjZBNzI4QTcyQUE3MkNBNzJFQTczMkE3MzRBNzM2QTczOEE3M0FBNzNDQTczRUE3NDBBNzQyQTc0NEE3NDZBNzQ4QTc0QUE3NENBNzRFQTc1MEE3NTJBNzU0QTc1NkE3NThBNzVBQTc1Q0E3NUVBNzYwQTc2MkE3NjRBNzY2QTc2OEE3NkFBNzZDQTc2RUE3NzlBNzdCQTc3REE3N0VBNzgwQTc4MkE3ODRBNzg2QTc4QkE3OERBNzkwQTc5MkE3QTBBN0EyQTdBNEE3QTZBN0E4QTdBQUZGMjEtRkYzQVwiLFxyXG4gICAgICAgIEx0OiBcIjAxQzUwMUM4MDFDQjAxRjIxRjg4LTFGOEYxRjk4LTFGOUYxRkE4LTFGQUYxRkJDMUZDQzFGRkNcIixcclxuICAgICAgICBMbTogXCIwMkIwLTAyQzEwMkM2LTAyRDEwMkUwLTAyRTQwMkVDMDJFRTAzNzQwMzdBMDU1OTA2NDAwNkU1MDZFNjA3RjQwN0Y1MDdGQTA4MUEwODI0MDgyODA5NzEwRTQ2MEVDNjEwRkMxN0Q3MTg0MzFBQTcxQzc4LTFDN0QxRDJDLTFENkExRDc4MUQ5Qi0xREJGMjA3MTIwN0YyMDkwLTIwOUMyQzdDMkM3RDJENkYyRTJGMzAwNTMwMzEtMzAzNTMwM0IzMDlEMzA5RTMwRkMtMzBGRUEwMTVBNEY4LUE0RkRBNjBDQTY3RkE3MTctQTcxRkE3NzBBNzg4QTdGOEE3RjlBOUNGQUE3MEFBRERBQUYzQUFGNEZGNzBGRjlFRkY5RlwiLFxyXG4gICAgICAgIExvOiBcIjAwQUEwMEJBMDFCQjAxQzAtMDFDMzAyOTQwNUQwLTA1RUEwNUYwLTA1RjIwNjIwLTA2M0YwNjQxLTA2NEEwNjZFMDY2RjA2NzEtMDZEMzA2RDUwNkVFMDZFRjA2RkEtMDZGQzA2RkYwNzEwMDcxMi0wNzJGMDc0RC0wN0E1MDdCMTA3Q0EtMDdFQTA4MDAtMDgxNTA4NDAtMDg1ODA4QTAwOEEyLTA4QUMwOTA0LTA5MzkwOTNEMDk1MDA5NTgtMDk2MTA5NzItMDk3NzA5NzktMDk3RjA5ODUtMDk4QzA5OEYwOTkwMDk5My0wOUE4MDlBQS0wOUIwMDlCMjA5QjYtMDlCOTA5QkQwOUNFMDlEQzA5REQwOURGLTA5RTEwOUYwMDlGMTBBMDUtMEEwQTBBMEYwQTEwMEExMy0wQTI4MEEyQS0wQTMwMEEzMjBBMzMwQTM1MEEzNjBBMzgwQTM5MEE1OS0wQTVDMEE1RTBBNzItMEE3NDBBODUtMEE4RDBBOEYtMEE5MTBBOTMtMEFBODBBQUEtMEFCMDBBQjIwQUIzMEFCNS0wQUI5MEFCRDBBRDAwQUUwMEFFMTBCMDUtMEIwQzBCMEYwQjEwMEIxMy0wQjI4MEIyQS0wQjMwMEIzMjBCMzMwQjM1LTBCMzkwQjNEMEI1QzBCNUQwQjVGLTBCNjEwQjcxMEI4MzBCODUtMEI4QTBCOEUtMEI5MDBCOTItMEI5NTBCOTkwQjlBMEI5QzBCOUUwQjlGMEJBMzBCQTQwQkE4LTBCQUEwQkFFLTBCQjkwQkQwMEMwNS0wQzBDMEMwRS0wQzEwMEMxMi0wQzI4MEMyQS0wQzMzMEMzNS0wQzM5MEMzRDBDNTgwQzU5MEM2MDBDNjEwQzg1LTBDOEMwQzhFLTBDOTAwQzkyLTBDQTgwQ0FBLTBDQjMwQ0I1LTBDQjkwQ0JEMENERTBDRTAwQ0UxMENGMTBDRjIwRDA1LTBEMEMwRDBFLTBEMTAwRDEyLTBEM0EwRDNEMEQ0RTBENjAwRDYxMEQ3QS0wRDdGMEQ4NS0wRDk2MEQ5QS0wREIxMERCMy0wREJCMERCRDBEQzAtMERDNjBFMDEtMEUzMDBFMzIwRTMzMEU0MC0wRTQ1MEU4MTBFODIwRTg0MEU4NzBFODgwRThBMEU4RDBFOTQtMEU5NzBFOTktMEU5RjBFQTEtMEVBMzBFQTUwRUE3MEVBQTBFQUIwRUFELTBFQjAwRUIyMEVCMzBFQkQwRUMwLTBFQzQwRURDLTBFREYwRjAwMEY0MC0wRjQ3MEY0OS0wRjZDMEY4OC0wRjhDMTAwMC0xMDJBMTAzRjEwNTAtMTA1NTEwNUEtMTA1RDEwNjExMDY1MTA2NjEwNkUtMTA3MDEwNzUtMTA4MTEwOEUxMEQwLTEwRkExMEZELTEyNDgxMjRBLTEyNEQxMjUwLTEyNTYxMjU4MTI1QS0xMjVEMTI2MC0xMjg4MTI4QS0xMjhEMTI5MC0xMkIwMTJCMi0xMkI1MTJCOC0xMkJFMTJDMDEyQzItMTJDNTEyQzgtMTJENjEyRDgtMTMxMDEzMTItMTMxNTEzMTgtMTM1QTEzODAtMTM4RjEzQTAtMTNGNDE0MDEtMTY2QzE2NkYtMTY3RjE2ODEtMTY5QTE2QTAtMTZFQTE3MDAtMTcwQzE3MEUtMTcxMTE3MjAtMTczMTE3NDAtMTc1MTE3NjAtMTc2QzE3NkUtMTc3MDE3ODAtMTdCMzE3REMxODIwLTE4NDIxODQ0LTE4NzcxODgwLTE4QTgxOEFBMThCMC0xOEY1MTkwMC0xOTFDMTk1MC0xOTZEMTk3MC0xOTc0MTk4MC0xOUFCMTlDMS0xOUM3MUEwMC0xQTE2MUEyMC0xQTU0MUIwNS0xQjMzMUI0NS0xQjRCMUI4My0xQkEwMUJBRTFCQUYxQkJBLTFCRTUxQzAwLTFDMjMxQzRELTFDNEYxQzVBLTFDNzcxQ0U5LTFDRUMxQ0VFLTFDRjExQ0Y1MUNGNjIxMzUtMjEzODJEMzAtMkQ2NzJEODAtMkQ5NjJEQTAtMkRBNjJEQTgtMkRBRTJEQjAtMkRCNjJEQjgtMkRCRTJEQzAtMkRDNjJEQzgtMkRDRTJERDAtMkRENjJERDgtMkRERTMwMDYzMDNDMzA0MS0zMDk2MzA5RjMwQTEtMzBGQTMwRkYzMTA1LTMxMkQzMTMxLTMxOEUzMUEwLTMxQkEzMUYwLTMxRkYzNDAwLTREQjU0RTAwLTlGQ0NBMDAwLUEwMTRBMDE2LUE0OENBNEQwLUE0RjdBNTAwLUE2MEJBNjEwLUE2MUZBNjJBQTYyQkE2NkVBNkEwLUE2RTVBN0ZCLUE4MDFBODAzLUE4MDVBODA3LUE4MEFBODBDLUE4MjJBODQwLUE4NzNBODgyLUE4QjNBOEYyLUE4RjdBOEZCQTkwQS1BOTI1QTkzMC1BOTQ2QTk2MC1BOTdDQTk4NC1BOUIyQUEwMC1BQTI4QUE0MC1BQTQyQUE0NC1BQTRCQUE2MC1BQTZGQUE3MS1BQTc2QUE3QUFBODAtQUFBRkFBQjFBQUI1QUFCNkFBQjktQUFCREFBQzBBQUMyQUFEQkFBRENBQUUwLUFBRUFBQUYyQUIwMS1BQjA2QUIwOS1BQjBFQUIxMS1BQjE2QUIyMC1BQjI2QUIyOC1BQjJFQUJDMC1BQkUyQUMwMC1EN0EzRDdCMC1EN0M2RDdDQi1EN0ZCRjkwMC1GQTZERkE3MC1GQUQ5RkIxREZCMUYtRkIyOEZCMkEtRkIzNkZCMzgtRkIzQ0ZCM0VGQjQwRkI0MUZCNDNGQjQ0RkI0Ni1GQkIxRkJEMy1GRDNERkQ1MC1GRDhGRkQ5Mi1GREM3RkRGMC1GREZCRkU3MC1GRTc0RkU3Ni1GRUZDRkY2Ni1GRjZGRkY3MS1GRjlERkZBMC1GRkJFRkZDMi1GRkM3RkZDQS1GRkNGRkZEMi1GRkQ3RkZEQS1GRkRDXCIsXHJcbiAgICAgICAgTTogXCIwMzAwLTAzNkYwNDgzLTA0ODkwNTkxLTA1QkQwNUJGMDVDMTA1QzIwNUM0MDVDNTA1QzcwNjEwLTA2MUEwNjRCLTA2NUYwNjcwMDZENi0wNkRDMDZERi0wNkU0MDZFNzA2RTgwNkVBLTA2RUQwNzExMDczMC0wNzRBMDdBNi0wN0IwMDdFQi0wN0YzMDgxNi0wODE5MDgxQi0wODIzMDgyNS0wODI3MDgyOS0wODJEMDg1OS0wODVCMDhFNC0wOEZFMDkwMC0wOTAzMDkzQS0wOTNDMDkzRS0wOTRGMDk1MS0wOTU3MDk2MjA5NjMwOTgxLTA5ODMwOUJDMDlCRS0wOUM0MDlDNzA5QzgwOUNCLTA5Q0QwOUQ3MDlFMjA5RTMwQTAxLTBBMDMwQTNDMEEzRS0wQTQyMEE0NzBBNDgwQTRCLTBBNEQwQTUxMEE3MDBBNzEwQTc1MEE4MS0wQTgzMEFCQzBBQkUtMEFDNTBBQzctMEFDOTBBQ0ItMEFDRDBBRTIwQUUzMEIwMS0wQjAzMEIzQzBCM0UtMEI0NDBCNDcwQjQ4MEI0Qi0wQjREMEI1NjBCNTcwQjYyMEI2MzBCODIwQkJFLTBCQzIwQkM2LTBCQzgwQkNBLTBCQ0QwQkQ3MEMwMS0wQzAzMEMzRS0wQzQ0MEM0Ni0wQzQ4MEM0QS0wQzREMEM1NTBDNTYwQzYyMEM2MzBDODIwQzgzMENCQzBDQkUtMENDNDBDQzYtMENDODBDQ0EtMENDRDBDRDUwQ0Q2MENFMjBDRTMwRDAyMEQwMzBEM0UtMEQ0NDBENDYtMEQ0ODBENEEtMEQ0RDBENTcwRDYyMEQ2MzBEODIwRDgzMERDQTBEQ0YtMERENDBERDYwREQ4LTBEREYwREYyMERGMzBFMzEwRTM0LTBFM0EwRTQ3LTBFNEUwRUIxMEVCNC0wRUI5MEVCQjBFQkMwRUM4LTBFQ0QwRjE4MEYxOTBGMzUwRjM3MEYzOTBGM0UwRjNGMEY3MS0wRjg0MEY4NjBGODcwRjhELTBGOTcwRjk5LTBGQkMwRkM2MTAyQi0xMDNFMTA1Ni0xMDU5MTA1RS0xMDYwMTA2Mi0xMDY0MTA2Ny0xMDZEMTA3MS0xMDc0MTA4Mi0xMDhEMTA4RjEwOUEtMTA5RDEzNUQtMTM1RjE3MTItMTcxNDE3MzItMTczNDE3NTIxNzUzMTc3MjE3NzMxN0I0LTE3RDMxN0REMTgwQi0xODBEMThBOTE5MjAtMTkyQjE5MzAtMTkzQjE5QjAtMTlDMDE5QzgxOUM5MUExNy0xQTFCMUE1NS0xQTVFMUE2MC0xQTdDMUE3RjFCMDAtMUIwNDFCMzQtMUI0NDFCNkItMUI3MzFCODAtMUI4MjFCQTEtMUJBRDFCRTYtMUJGMzFDMjQtMUMzNzFDRDAtMUNEMjFDRDQtMUNFODFDRUQxQ0YyLTFDRjQxREMwLTFERTYxREZDLTFERkYyMEQwLTIwRjAyQ0VGLTJDRjEyRDdGMkRFMC0yREZGMzAyQS0zMDJGMzA5OTMwOUFBNjZGLUE2NzJBNjc0LUE2N0RBNjlGQTZGMEE2RjFBODAyQTgwNkE4MEJBODIzLUE4MjdBODgwQTg4MUE4QjQtQThDNEE4RTAtQThGMUE5MjYtQTkyREE5NDctQTk1M0E5ODAtQTk4M0E5QjMtQTlDMEFBMjktQUEzNkFBNDNBQTRDQUE0REFBN0JBQUIwQUFCMi1BQUI0QUFCN0FBQjhBQUJFQUFCRkFBQzFBQUVCLUFBRUZBQUY1QUFGNkFCRTMtQUJFQUFCRUNBQkVERkIxRUZFMDAtRkUwRkZFMjAtRkUyNlwiLFxyXG4gICAgICAgIE1uOiBcIjAzMDAtMDM2RjA0ODMtMDQ4NzA1OTEtMDVCRDA1QkYwNUMxMDVDMjA1QzQwNUM1MDVDNzA2MTAtMDYxQTA2NEItMDY1RjA2NzAwNkQ2LTA2REMwNkRGLTA2RTQwNkU3MDZFODA2RUEtMDZFRDA3MTEwNzMwLTA3NEEwN0E2LTA3QjAwN0VCLTA3RjMwODE2LTA4MTkwODFCLTA4MjMwODI1LTA4MjcwODI5LTA4MkQwODU5LTA4NUIwOEU0LTA4RkUwOTAwLTA5MDIwOTNBMDkzQzA5NDEtMDk0ODA5NEQwOTUxLTA5NTcwOTYyMDk2MzA5ODEwOUJDMDlDMS0wOUM0MDlDRDA5RTIwOUUzMEEwMTBBMDIwQTNDMEE0MTBBNDIwQTQ3MEE0ODBBNEItMEE0RDBBNTEwQTcwMEE3MTBBNzUwQTgxMEE4MjBBQkMwQUMxLTBBQzUwQUM3MEFDODBBQ0QwQUUyMEFFMzBCMDEwQjNDMEIzRjBCNDEtMEI0NDBCNEQwQjU2MEI2MjBCNjMwQjgyMEJDMDBCQ0QwQzNFLTBDNDAwQzQ2LTBDNDgwQzRBLTBDNEQwQzU1MEM1NjBDNjIwQzYzMENCQzBDQkYwQ0M2MENDQzBDQ0QwQ0UyMENFMzBENDEtMEQ0NDBENEQwRDYyMEQ2MzBEQ0EwREQyLTBERDQwREQ2MEUzMTBFMzQtMEUzQTBFNDctMEU0RTBFQjEwRUI0LTBFQjkwRUJCMEVCQzBFQzgtMEVDRDBGMTgwRjE5MEYzNTBGMzcwRjM5MEY3MS0wRjdFMEY4MC0wRjg0MEY4NjBGODcwRjhELTBGOTcwRjk5LTBGQkMwRkM2MTAyRC0xMDMwMTAzMi0xMDM3MTAzOTEwM0ExMDNEMTAzRTEwNTgxMDU5MTA1RS0xMDYwMTA3MS0xMDc0MTA4MjEwODUxMDg2MTA4RDEwOUQxMzVELTEzNUYxNzEyLTE3MTQxNzMyLTE3MzQxNzUyMTc1MzE3NzIxNzczMTdCNDE3QjUxN0I3LTE3QkQxN0M2MTdDOS0xN0QzMTdERDE4MEItMTgwRDE4QTkxOTIwLTE5MjIxOTI3MTkyODE5MzIxOTM5LTE5M0IxQTE3MUExODFBNTYxQTU4LTFBNUUxQTYwMUE2MjFBNjUtMUE2QzFBNzMtMUE3QzFBN0YxQjAwLTFCMDMxQjM0MUIzNi0xQjNBMUIzQzFCNDIxQjZCLTFCNzMxQjgwMUI4MTFCQTItMUJBNTFCQTgxQkE5MUJBQjFCRTYxQkU4MUJFOTFCRUQxQkVGLTFCRjExQzJDLTFDMzMxQzM2MUMzNzFDRDAtMUNEMjFDRDQtMUNFMDFDRTItMUNFODFDRUQxQ0Y0MURDMC0xREU2MURGQy0xREZGMjBEMC0yMERDMjBFMTIwRTUtMjBGMDJDRUYtMkNGMTJEN0YyREUwLTJERkYzMDJBLTMwMkQzMDk5MzA5QUE2NkZBNjc0LUE2N0RBNjlGQTZGMEE2RjFBODAyQTgwNkE4MEJBODI1QTgyNkE4QzRBOEUwLUE4RjFBOTI2LUE5MkRBOTQ3LUE5NTFBOTgwLUE5ODJBOUIzQTlCNi1BOUI5QTlCQ0FBMjktQUEyRUFBMzFBQTMyQUEzNUFBMzZBQTQzQUE0Q0FBQjBBQUIyLUFBQjRBQUI3QUFCOEFBQkVBQUJGQUFDMUFBRUNBQUVEQUFGNkFCRTVBQkU4QUJFREZCMUVGRTAwLUZFMEZGRTIwLUZFMjZcIixcclxuICAgICAgICBNYzogXCIwOTAzMDkzQjA5M0UtMDk0MDA5NDktMDk0QzA5NEUwOTRGMDk4MjA5ODMwOUJFLTA5QzAwOUM3MDlDODA5Q0IwOUNDMDlENzBBMDMwQTNFLTBBNDAwQTgzMEFCRS0wQUMwMEFDOTBBQ0IwQUNDMEIwMjBCMDMwQjNFMEI0MDBCNDcwQjQ4MEI0QjBCNEMwQjU3MEJCRTBCQkYwQkMxMEJDMjBCQzYtMEJDODBCQ0EtMEJDQzBCRDcwQzAxLTBDMDMwQzQxLTBDNDQwQzgyMEM4MzBDQkUwQ0MwLTBDQzQwQ0M3MENDODBDQ0EwQ0NCMENENTBDRDYwRDAyMEQwMzBEM0UtMEQ0MDBENDYtMEQ0ODBENEEtMEQ0QzBENTcwRDgyMEQ4MzBEQ0YtMEREMTBERDgtMERERjBERjIwREYzMEYzRTBGM0YwRjdGMTAyQjEwMkMxMDMxMTAzODEwM0IxMDNDMTA1NjEwNTcxMDYyLTEwNjQxMDY3LTEwNkQxMDgzMTA4NDEwODctMTA4QzEwOEYxMDlBLTEwOUMxN0I2MTdCRS0xN0M1MTdDNzE3QzgxOTIzLTE5MjYxOTI5LTE5MkIxOTMwMTkzMTE5MzMtMTkzODE5QjAtMTlDMDE5QzgxOUM5MUExOS0xQTFCMUE1NTFBNTcxQTYxMUE2MzFBNjQxQTZELTFBNzIxQjA0MUIzNTFCM0IxQjNELTFCNDExQjQzMUI0NDFCODIxQkExMUJBNjFCQTcxQkFBMUJBQzFCQUQxQkU3MUJFQS0xQkVDMUJFRTFCRjIxQkYzMUMyNC0xQzJCMUMzNDFDMzUxQ0UxMUNGMjFDRjMzMDJFMzAyRkE4MjNBODI0QTgyN0E4ODBBODgxQThCNC1BOEMzQTk1MkE5NTNBOTgzQTlCNEE5QjVBOUJBQTlCQkE5QkQtQTlDMEFBMkZBQTMwQUEzM0FBMzRBQTREQUE3QkFBRUJBQUVFQUFFRkFBRjVBQkUzQUJFNEFCRTZBQkU3QUJFOUFCRUFBQkVDXCIsXHJcbiAgICAgICAgTWU6IFwiMDQ4ODA0ODkyMERELTIwRTAyMEUyLTIwRTRBNjcwLUE2NzJcIixcclxuICAgICAgICBOOiBcIjAwMzAtMDAzOTAwQjIwMEIzMDBCOTAwQkMtMDBCRTA2NjAtMDY2OTA2RjAtMDZGOTA3QzAtMDdDOTA5NjYtMDk2RjA5RTYtMDlFRjA5RjQtMDlGOTBBNjYtMEE2RjBBRTYtMEFFRjBCNjYtMEI2RjBCNzItMEI3NzBCRTYtMEJGMjBDNjYtMEM2RjBDNzgtMEM3RTBDRTYtMENFRjBENjYtMEQ3NTBFNTAtMEU1OTBFRDAtMEVEOTBGMjAtMEYzMzEwNDAtMTA0OTEwOTAtMTA5OTEzNjktMTM3QzE2RUUtMTZGMDE3RTAtMTdFOTE3RjAtMTdGOTE4MTAtMTgxOTE5NDYtMTk0RjE5RDAtMTlEQTFBODAtMUE4OTFBOTAtMUE5OTFCNTAtMUI1OTFCQjAtMUJCOTFDNDAtMUM0OTFDNTAtMUM1OTIwNzAyMDc0LTIwNzkyMDgwLTIwODkyMTUwLTIxODIyMTg1LTIxODkyNDYwLTI0OUIyNEVBLTI0RkYyNzc2LTI3OTMyQ0ZEMzAwNzMwMjEtMzAyOTMwMzgtMzAzQTMxOTItMzE5NTMyMjAtMzIyOTMyNDgtMzI0RjMyNTEtMzI1RjMyODAtMzI4OTMyQjEtMzJCRkE2MjAtQTYyOUE2RTYtQTZFRkE4MzAtQTgzNUE4RDAtQThEOUE5MDAtQTkwOUE5RDAtQTlEOUFBNTAtQUE1OUFCRjAtQUJGOUZGMTAtRkYxOVwiLFxyXG4gICAgICAgIE5kOiBcIjAwMzAtMDAzOTA2NjAtMDY2OTA2RjAtMDZGOTA3QzAtMDdDOTA5NjYtMDk2RjA5RTYtMDlFRjBBNjYtMEE2RjBBRTYtMEFFRjBCNjYtMEI2RjBCRTYtMEJFRjBDNjYtMEM2RjBDRTYtMENFRjBENjYtMEQ2RjBFNTAtMEU1OTBFRDAtMEVEOTBGMjAtMEYyOTEwNDAtMTA0OTEwOTAtMTA5OTE3RTAtMTdFOTE4MTAtMTgxOTE5NDYtMTk0RjE5RDAtMTlEOTFBODAtMUE4OTFBOTAtMUE5OTFCNTAtMUI1OTFCQjAtMUJCOTFDNDAtMUM0OTFDNTAtMUM1OUE2MjAtQTYyOUE4RDAtQThEOUE5MDAtQTkwOUE5RDAtQTlEOUFBNTAtQUE1OUFCRjAtQUJGOUZGMTAtRkYxOVwiLFxyXG4gICAgICAgIE5sOiBcIjE2RUUtMTZGMDIxNjAtMjE4MjIxODUtMjE4ODMwMDczMDIxLTMwMjkzMDM4LTMwM0FBNkU2LUE2RUZcIixcclxuICAgICAgICBObzogXCIwMEIyMDBCMzAwQjkwMEJDLTAwQkUwOUY0LTA5RjkwQjcyLTBCNzcwQkYwLTBCRjIwQzc4LTBDN0UwRDcwLTBENzUwRjJBLTBGMzMxMzY5LTEzN0MxN0YwLTE3RjkxOURBMjA3MDIwNzQtMjA3OTIwODAtMjA4OTIxNTAtMjE1RjIxODkyNDYwLTI0OUIyNEVBLTI0RkYyNzc2LTI3OTMyQ0ZEMzE5Mi0zMTk1MzIyMC0zMjI5MzI0OC0zMjRGMzI1MS0zMjVGMzI4MC0zMjg5MzJCMS0zMkJGQTgzMC1BODM1XCIsXHJcbiAgICAgICAgUDogXCIwMDIxLTAwMjMwMDI1LTAwMkEwMDJDLTAwMkYwMDNBMDAzQjAwM0YwMDQwMDA1Qi0wMDVEMDA1RjAwN0IwMDdEMDBBMTAwQTcwMEFCMDBCNjAwQjcwMEJCMDBCRjAzN0UwMzg3MDU1QS0wNTVGMDU4OTA1OEEwNUJFMDVDMDA1QzMwNUM2MDVGMzA1RjQwNjA5MDYwQTA2MEMwNjBEMDYxQjA2MUUwNjFGMDY2QS0wNjZEMDZENDA3MDAtMDcwRDA3RjctMDdGOTA4MzAtMDgzRTA4NUUwOTY0MDk2NTA5NzAwQUYwMERGNDBFNEYwRTVBMEU1QjBGMDQtMEYxMjBGMTQwRjNBLTBGM0QwRjg1MEZEMC0wRkQ0MEZEOTBGREExMDRBLTEwNEYxMEZCMTM2MC0xMzY4MTQwMDE2NkQxNjZFMTY5QjE2OUMxNkVCLTE2RUQxNzM1MTczNjE3RDQtMTdENjE3RDgtMTdEQTE4MDAtMTgwQTE5NDQxOTQ1MUExRTFBMUYxQUEwLTFBQTYxQUE4LTFBQUQxQjVBLTFCNjAxQkZDLTFCRkYxQzNCLTFDM0YxQzdFMUM3RjFDQzAtMUNDNzFDRDMyMDEwLTIwMjcyMDMwLTIwNDMyMDQ1LTIwNTEyMDUzLTIwNUUyMDdEMjA3RTIwOEQyMDhFMjMyOTIzMkEyNzY4LTI3NzUyN0M1MjdDNjI3RTYtMjdFRjI5ODMtMjk5ODI5RDgtMjlEQjI5RkMyOUZEMkNGOS0yQ0ZDMkNGRTJDRkYyRDcwMkUwMC0yRTJFMkUzMC0yRTNCMzAwMS0zMDAzMzAwOC0zMDExMzAxNC0zMDFGMzAzMDMwM0QzMEEwMzBGQkE0RkVBNEZGQTYwRC1BNjBGQTY3M0E2N0VBNkYyLUE2RjdBODc0LUE4NzdBOENFQThDRkE4RjgtQThGQUE5MkVBOTJGQTk1RkE5QzEtQTlDREE5REVBOURGQUE1Qy1BQTVGQUFERUFBREZBQUYwQUFGMUFCRUJGRDNFRkQzRkZFMTAtRkUxOUZFMzAtRkU1MkZFNTQtRkU2MUZFNjNGRTY4RkU2QUZFNkJGRjAxLUZGMDNGRjA1LUZGMEFGRjBDLUZGMEZGRjFBRkYxQkZGMUZGRjIwRkYzQi1GRjNERkYzRkZGNUJGRjVERkY1Ri1GRjY1XCIsXHJcbiAgICAgICAgUGQ6IFwiMDAyRDA1OEEwNUJFMTQwMDE4MDYyMDEwLTIwMTUyRTE3MkUxQTJFM0EyRTNCMzAxQzMwMzAzMEEwRkUzMUZFMzJGRTU4RkU2M0ZGMERcIixcclxuICAgICAgICBQczogXCIwMDI4MDA1QjAwN0IwRjNBMEYzQzE2OUIyMDFBMjAxRTIwNDUyMDdEMjA4RDIzMjkyNzY4Mjc2QTI3NkMyNzZFMjc3MDI3NzIyNzc0MjdDNTI3RTYyN0U4MjdFQTI3RUMyN0VFMjk4MzI5ODUyOTg3Mjk4OTI5OEIyOThEMjk4RjI5OTEyOTkzMjk5NTI5OTcyOUQ4MjlEQTI5RkMyRTIyMkUyNDJFMjYyRTI4MzAwODMwMEEzMDBDMzAwRTMwMTAzMDE0MzAxNjMwMTgzMDFBMzAxREZEM0VGRTE3RkUzNUZFMzdGRTM5RkUzQkZFM0RGRTNGRkU0MUZFNDNGRTQ3RkU1OUZFNUJGRTVERkYwOEZGM0JGRjVCRkY1RkZGNjJcIixcclxuICAgICAgICBQZTogXCIwMDI5MDA1RDAwN0QwRjNCMEYzRDE2OUMyMDQ2MjA3RTIwOEUyMzJBMjc2OTI3NkIyNzZEMjc2RjI3NzEyNzczMjc3NTI3QzYyN0U3MjdFOTI3RUIyN0VEMjdFRjI5ODQyOTg2Mjk4ODI5OEEyOThDMjk4RTI5OTAyOTkyMjk5NDI5OTYyOTk4MjlEOTI5REIyOUZEMkUyMzJFMjUyRTI3MkUyOTMwMDkzMDBCMzAwRDMwMEYzMDExMzAxNTMwMTczMDE5MzAxQjMwMUUzMDFGRkQzRkZFMThGRTM2RkUzOEZFM0FGRTNDRkUzRUZFNDBGRTQyRkU0NEZFNDhGRTVBRkU1Q0ZFNUVGRjA5RkYzREZGNURGRjYwRkY2M1wiLFxyXG4gICAgICAgIFBpOiBcIjAwQUIyMDE4MjAxQjIwMUMyMDFGMjAzOTJFMDIyRTA0MkUwOTJFMEMyRTFDMkUyMFwiLFxyXG4gICAgICAgIFBmOiBcIjAwQkIyMDE5MjAxRDIwM0EyRTAzMkUwNTJFMEEyRTBEMkUxRDJFMjFcIixcclxuICAgICAgICBQYzogXCIwMDVGMjAzRjIwNDAyMDU0RkUzM0ZFMzRGRTRELUZFNEZGRjNGXCIsXHJcbiAgICAgICAgUG86IFwiMDAyMS0wMDIzMDAyNS0wMDI3MDAyQTAwMkMwMDJFMDAyRjAwM0EwMDNCMDAzRjAwNDAwMDVDMDBBMTAwQTcwMEI2MDBCNzAwQkYwMzdFMDM4NzA1NUEtMDU1RjA1ODkwNUMwMDVDMzA1QzYwNUYzMDVGNDA2MDkwNjBBMDYwQzA2MEQwNjFCMDYxRTA2MUYwNjZBLTA2NkQwNkQ0MDcwMC0wNzBEMDdGNy0wN0Y5MDgzMC0wODNFMDg1RTA5NjQwOTY1MDk3MDBBRjAwREY0MEU0RjBFNUEwRTVCMEYwNC0wRjEyMEYxNDBGODUwRkQwLTBGRDQwRkQ5MEZEQTEwNEEtMTA0RjEwRkIxMzYwLTEzNjgxNjZEMTY2RTE2RUItMTZFRDE3MzUxNzM2MTdENC0xN0Q2MTdEOC0xN0RBMTgwMC0xODA1MTgwNy0xODBBMTk0NDE5NDUxQTFFMUExRjFBQTAtMUFBNjFBQTgtMUFBRDFCNUEtMUI2MDFCRkMtMUJGRjFDM0ItMUMzRjFDN0UxQzdGMUNDMC0xQ0M3MUNEMzIwMTYyMDE3MjAyMC0yMDI3MjAzMC0yMDM4MjAzQi0yMDNFMjA0MS0yMDQzMjA0Ny0yMDUxMjA1MzIwNTUtMjA1RTJDRjktMkNGQzJDRkUyQ0ZGMkQ3MDJFMDAyRTAxMkUwNi0yRTA4MkUwQjJFMEUtMkUxNjJFMTgyRTE5MkUxQjJFMUUyRTFGMkUyQS0yRTJFMkUzMC0yRTM5MzAwMS0zMDAzMzAzRDMwRkJBNEZFQTRGRkE2MEQtQTYwRkE2NzNBNjdFQTZGMi1BNkY3QTg3NC1BODc3QThDRUE4Q0ZBOEY4LUE4RkFBOTJFQTkyRkE5NUZBOUMxLUE5Q0RBOURFQTlERkFBNUMtQUE1RkFBREVBQURGQUFGMEFBRjFBQkVCRkUxMC1GRTE2RkUxOUZFMzBGRTQ1RkU0NkZFNDktRkU0Q0ZFNTAtRkU1MkZFNTQtRkU1N0ZFNUYtRkU2MUZFNjhGRTZBRkU2QkZGMDEtRkYwM0ZGMDUtRkYwN0ZGMEFGRjBDRkYwRUZGMEZGRjFBRkYxQkZGMUZGRjIwRkYzQ0ZGNjFGRjY0RkY2NVwiLFxyXG4gICAgICAgIFM6IFwiMDAyNDAwMkIwMDNDLTAwM0UwMDVFMDA2MDAwN0MwMDdFMDBBMi0wMEE2MDBBODAwQTkwMEFDMDBBRS0wMEIxMDBCNDAwQjgwMEQ3MDBGNzAyQzItMDJDNTAyRDItMDJERjAyRTUtMDJFQjAyRUQwMkVGLTAyRkYwMzc1MDM4NDAzODUwM0Y2MDQ4MjA1OEYwNjA2LTA2MDgwNjBCMDYwRTA2MEYwNkRFMDZFOTA2RkQwNkZFMDdGNjA5RjIwOUYzMDlGQTA5RkIwQUYxMEI3MDBCRjMtMEJGQTBDN0YwRDc5MEUzRjBGMDEtMEYwMzBGMTMwRjE1LTBGMTcwRjFBLTBGMUYwRjM0MEYzNjBGMzgwRkJFLTBGQzUwRkM3LTBGQ0MwRkNFMEZDRjBGRDUtMEZEODEwOUUxMDlGMTM5MC0xMzk5MTdEQjE5NDAxOURFLTE5RkYxQjYxLTFCNkExQjc0LTFCN0MxRkJEMUZCRi0xRkMxMUZDRC0xRkNGMUZERC0xRkRGMUZFRC0xRkVGMUZGRDFGRkUyMDQ0MjA1MjIwN0EtMjA3QzIwOEEtMjA4QzIwQTAtMjBCOTIxMDAyMTAxMjEwMy0yMTA2MjEwODIxMDkyMTE0MjExNi0yMTE4MjExRS0yMTIzMjEyNTIxMjcyMTI5MjEyRTIxM0EyMTNCMjE0MC0yMTQ0MjE0QS0yMTREMjE0RjIxOTAtMjMyODIzMkItMjNGMzI0MDAtMjQyNjI0NDAtMjQ0QTI0OUMtMjRFOTI1MDAtMjZGRjI3MDEtMjc2NzI3OTQtMjdDNDI3QzctMjdFNTI3RjAtMjk4MjI5OTktMjlENzI5REMtMjlGQjI5RkUtMkI0QzJCNTAtMkI1OTJDRTUtMkNFQTJFODAtMkU5OTJFOUItMkVGMzJGMDAtMkZENTJGRjAtMkZGQjMwMDQzMDEyMzAxMzMwMjAzMDM2MzAzNzMwM0UzMDNGMzA5QjMwOUMzMTkwMzE5MTMxOTYtMzE5RjMxQzAtMzFFMzMyMDAtMzIxRTMyMkEtMzI0NzMyNTAzMjYwLTMyN0YzMjhBLTMyQjAzMkMwLTMyRkUzMzAwLTMzRkY0REMwLTRERkZBNDkwLUE0QzZBNzAwLUE3MTZBNzIwQTcyMUE3ODlBNzhBQTgyOC1BODJCQTgzNi1BODM5QUE3Ny1BQTc5RkIyOUZCQjItRkJDMUZERkNGREZERkU2MkZFNjQtRkU2NkZFNjlGRjA0RkYwQkZGMUMtRkYxRUZGM0VGRjQwRkY1Q0ZGNUVGRkUwLUZGRTZGRkU4LUZGRUVGRkZDRkZGRFwiLFxyXG4gICAgICAgIFNtOiBcIjAwMkIwMDNDLTAwM0UwMDdDMDA3RTAwQUMwMEIxMDBENzAwRjcwM0Y2MDYwNi0wNjA4MjA0NDIwNTIyMDdBLTIwN0MyMDhBLTIwOEMyMTE4MjE0MC0yMTQ0MjE0QjIxOTAtMjE5NDIxOUEyMTlCMjFBMDIxQTMyMUE2MjFBRTIxQ0UyMUNGMjFEMjIxRDQyMUY0LTIyRkYyMzA4LTIzMEIyMzIwMjMyMTIzN0MyMzlCLTIzQjMyM0RDLTIzRTEyNUI3MjVDMTI1RjgtMjVGRjI2NkYyN0MwLTI3QzQyN0M3LTI3RTUyN0YwLTI3RkYyOTAwLTI5ODIyOTk5LTI5RDcyOURDLTI5RkIyOUZFLTJBRkYyQjMwLTJCNDQyQjQ3LTJCNENGQjI5RkU2MkZFNjQtRkU2NkZGMEJGRjFDLUZGMUVGRjVDRkY1RUZGRTJGRkU5LUZGRUNcIixcclxuICAgICAgICBTYzogXCIwMDI0MDBBMi0wMEE1MDU4RjA2MEIwOUYyMDlGMzA5RkIwQUYxMEJGOTBFM0YxN0RCMjBBMC0yMEI5QTgzOEZERkNGRTY5RkYwNEZGRTBGRkUxRkZFNUZGRTZcIixcclxuICAgICAgICBTazogXCIwMDVFMDA2MDAwQTgwMEFGMDBCNDAwQjgwMkMyLTAyQzUwMkQyLTAyREYwMkU1LTAyRUIwMkVEMDJFRi0wMkZGMDM3NTAzODQwMzg1MUZCRDFGQkYtMUZDMTFGQ0QtMUZDRjFGREQtMUZERjFGRUQtMUZFRjFGRkQxRkZFMzA5QjMwOUNBNzAwLUE3MTZBNzIwQTcyMUE3ODlBNzhBRkJCMi1GQkMxRkYzRUZGNDBGRkUzXCIsXHJcbiAgICAgICAgU286IFwiMDBBNjAwQTkwMEFFMDBCMDA0ODIwNjBFMDYwRjA2REUwNkU5MDZGRDA2RkUwN0Y2MDlGQTBCNzAwQkYzLTBCRjgwQkZBMEM3RjBENzkwRjAxLTBGMDMwRjEzMEYxNS0wRjE3MEYxQS0wRjFGMEYzNDBGMzYwRjM4MEZCRS0wRkM1MEZDNy0wRkNDMEZDRTBGQ0YwRkQ1LTBGRDgxMDlFMTA5RjEzOTAtMTM5OTE5NDAxOURFLTE5RkYxQjYxLTFCNkExQjc0LTFCN0MyMTAwMjEwMTIxMDMtMjEwNjIxMDgyMTA5MjExNDIxMTYyMTE3MjExRS0yMTIzMjEyNTIxMjcyMTI5MjEyRTIxM0EyMTNCMjE0QTIxNEMyMTREMjE0RjIxOTUtMjE5OTIxOUMtMjE5RjIxQTEyMUEyMjFBNDIxQTUyMUE3LTIxQUQyMUFGLTIxQ0QyMUQwMjFEMTIxRDMyMUQ1LTIxRjMyMzAwLTIzMDcyMzBDLTIzMUYyMzIyLTIzMjgyMzJCLTIzN0IyMzdELTIzOUEyM0I0LTIzREIyM0UyLTIzRjMyNDAwLTI0MjYyNDQwLTI0NEEyNDlDLTI0RTkyNTAwLTI1QjYyNUI4LTI1QzAyNUMyLTI1RjcyNjAwLTI2NkUyNjcwLTI2RkYyNzAxLTI3NjcyNzk0LTI3QkYyODAwLTI4RkYyQjAwLTJCMkYyQjQ1MkI0NjJCNTAtMkI1OTJDRTUtMkNFQTJFODAtMkU5OTJFOUItMkVGMzJGMDAtMkZENTJGRjAtMkZGQjMwMDQzMDEyMzAxMzMwMjAzMDM2MzAzNzMwM0UzMDNGMzE5MDMxOTEzMTk2LTMxOUYzMUMwLTMxRTMzMjAwLTMyMUUzMjJBLTMyNDczMjUwMzI2MC0zMjdGMzI4QS0zMkIwMzJDMC0zMkZFMzMwMC0zM0ZGNERDMC00REZGQTQ5MC1BNEM2QTgyOC1BODJCQTgzNkE4MzdBODM5QUE3Ny1BQTc5RkRGREZGRTRGRkU4RkZFREZGRUVGRkZDRkZGRFwiLFxyXG4gICAgICAgIFo6IFwiMDAyMDAwQTAxNjgwMTgwRTIwMDAtMjAwQTIwMjgyMDI5MjAyRjIwNUYzMDAwXCIsXHJcbiAgICAgICAgWnM6IFwiMDAyMDAwQTAxNjgwMTgwRTIwMDAtMjAwQTIwMkYyMDVGMzAwMFwiLFxyXG4gICAgICAgIFpsOiBcIjIwMjhcIixcclxuICAgICAgICBacDogXCIyMDI5XCIsXHJcbiAgICAgICAgQzogXCIwMDAwLTAwMUYwMDdGLTAwOUYwMEFEMDM3ODAzNzkwMzdGLTAzODMwMzhCMDM4RDAzQTIwNTI4LTA1MzAwNTU3MDU1ODA1NjAwNTg4MDU4Qi0wNThFMDU5MDA1QzgtMDVDRjA1RUItMDVFRjA1RjUtMDYwNTA2MUMwNjFEMDZERDA3MEUwNzBGMDc0QjA3NEMwN0IyLTA3QkYwN0ZCLTA3RkYwODJFMDgyRjA4M0YwODVDMDg1RDA4NUYtMDg5RjA4QTEwOEFELTA4RTMwOEZGMDk3ODA5ODAwOTg0MDk4RDA5OEUwOTkxMDk5MjA5QTkwOUIxMDlCMy0wOUI1MDlCQTA5QkIwOUM1MDlDNjA5QzkwOUNBMDlDRi0wOUQ2MDlEOC0wOURCMDlERTA5RTQwOUU1MDlGQy0wQTAwMEEwNDBBMEItMEEwRTBBMTEwQTEyMEEyOTBBMzEwQTM0MEEzNzBBM0EwQTNCMEEzRDBBNDMtMEE0NjBBNDkwQTRBMEE0RS0wQTUwMEE1Mi0wQTU4MEE1RDBBNUYtMEE2NTBBNzYtMEE4MDBBODQwQThFMEE5MjBBQTkwQUIxMEFCNDBBQkEwQUJCMEFDNjBBQ0EwQUNFMEFDRjBBRDEtMEFERjBBRTQwQUU1MEFGMi0wQjAwMEIwNDBCMEQwQjBFMEIxMTBCMTIwQjI5MEIzMTBCMzQwQjNBMEIzQjBCNDUwQjQ2MEI0OTBCNEEwQjRFLTBCNTUwQjU4LTBCNUIwQjVFMEI2NDBCNjUwQjc4LTBCODEwQjg0MEI4Qi0wQjhEMEI5MTBCOTYtMEI5ODBCOUIwQjlEMEJBMC0wQkEyMEJBNS0wQkE3MEJBQi0wQkFEMEJCQS0wQkJEMEJDMy0wQkM1MEJDOTBCQ0UwQkNGMEJEMS0wQkQ2MEJEOC0wQkU1MEJGQi0wQzAwMEMwNDBDMEQwQzExMEMyOTBDMzQwQzNBLTBDM0MwQzQ1MEM0OTBDNEUtMEM1NDBDNTcwQzVBLTBDNUYwQzY0MEM2NTBDNzAtMEM3NzBDODAwQzgxMEM4NDBDOEQwQzkxMENBOTBDQjQwQ0JBMENCQjBDQzUwQ0M5MENDRS0wQ0Q0MENENy0wQ0REMENERjBDRTQwQ0U1MENGMDBDRjMtMEQwMTBEMDQwRDBEMEQxMTBEM0IwRDNDMEQ0NTBENDkwRDRGLTBENTYwRDU4LTBENUYwRDY0MEQ2NTBENzYtMEQ3ODBEODAwRDgxMEQ4NDBEOTctMEQ5OTBEQjIwREJDMERCRTBEQkYwREM3LTBEQzkwRENCLTBEQ0UwREQ1MERENzBERTAtMERGMTBERjUtMEUwMDBFM0ItMEUzRTBFNUMtMEU4MDBFODMwRTg1MEU4NjBFODkwRThCMEU4QzBFOEUtMEU5MzBFOTgwRUEwMEVBNDBFQTYwRUE4MEVBOTBFQUMwRUJBMEVCRTBFQkYwRUM1MEVDNzBFQ0UwRUNGMEVEQTBFREIwRUUwLTBFRkYwRjQ4MEY2RC0wRjcwMEY5ODBGQkQwRkNEMEZEQi0wRkZGMTBDNjEwQzgtMTBDQzEwQ0UxMENGMTI0OTEyNEUxMjRGMTI1NzEyNTkxMjVFMTI1RjEyODkxMjhFMTI4RjEyQjExMkI2MTJCNzEyQkYxMkMxMTJDNjEyQzcxMkQ3MTMxMTEzMTYxMzE3MTM1QjEzNUMxMzdELTEzN0YxMzlBLTEzOUYxM0Y1LTEzRkYxNjlELTE2OUYxNkYxLTE2RkYxNzBEMTcxNS0xNzFGMTczNy0xNzNGMTc1NC0xNzVGMTc2RDE3NzExNzc0LTE3N0YxN0RFMTdERjE3RUEtMTdFRjE3RkEtMTdGRjE4MEYxODFBLTE4MUYxODc4LTE4N0YxOEFCLTE4QUYxOEY2LTE4RkYxOTFELTE5MUYxOTJDLTE5MkYxOTNDLTE5M0YxOTQxLTE5NDMxOTZFMTk2RjE5NzUtMTk3RjE5QUMtMTlBRjE5Q0EtMTlDRjE5REItMTlERDFBMUMxQTFEMUE1RjFBN0QxQTdFMUE4QS0xQThGMUE5QS0xQTlGMUFBRS0xQUZGMUI0Qy0xQjRGMUI3RC0xQjdGMUJGNC0xQkZCMUMzOC0xQzNBMUM0QS0xQzRDMUM4MC0xQ0JGMUNDOC0xQ0NGMUNGNy0xQ0ZGMURFNy0xREZCMUYxNjFGMTcxRjFFMUYxRjFGNDYxRjQ3MUY0RTFGNEYxRjU4MUY1QTFGNUMxRjVFMUY3RTFGN0YxRkI1MUZDNTFGRDQxRkQ1MUZEQzFGRjAxRkYxMUZGNTFGRkYyMDBCLTIwMEYyMDJBLTIwMkUyMDYwLTIwNkYyMDcyMjA3MzIwOEYyMDlELTIwOUYyMEJBLTIwQ0YyMEYxLTIwRkYyMThBLTIxOEYyM0Y0LTIzRkYyNDI3LTI0M0YyNDRCLTI0NUYyNzAwMkI0RC0yQjRGMkI1QS0yQkZGMkMyRjJDNUYyQ0Y0LTJDRjgyRDI2MkQyOC0yRDJDMkQyRTJEMkYyRDY4LTJENkUyRDcxLTJEN0UyRDk3LTJEOUYyREE3MkRBRjJEQjcyREJGMkRDNzJEQ0YyREQ3MkRERjJFM0MtMkU3RjJFOUEyRUY0LTJFRkYyRkQ2LTJGRUYyRkZDLTJGRkYzMDQwMzA5NzMwOTgzMTAwLTMxMDQzMTJFLTMxMzAzMThGMzFCQi0zMUJGMzFFNC0zMUVGMzIxRjMyRkY0REI2LTREQkY5RkNELTlGRkZBNDhELUE0OEZBNEM3LUE0Q0ZBNjJDLUE2M0ZBNjk4LUE2OUVBNkY4LUE2RkZBNzhGQTc5NC1BNzlGQTdBQi1BN0Y3QTgyQy1BODJGQTgzQS1BODNGQTg3OC1BODdGQThDNS1BOENEQThEQS1BOERGQThGQy1BOEZGQTk1NC1BOTVFQTk3RC1BOTdGQTlDRUE5REEtQTlEREE5RTAtQTlGRkFBMzctQUEzRkFBNEVBQTRGQUE1QUFBNUJBQTdDLUFBN0ZBQUMzLUFBREFBQUY3LUFCMDBBQjA3QUIwOEFCMEZBQjEwQUIxNy1BQjFGQUIyN0FCMkYtQUJCRkFCRUVBQkVGQUJGQS1BQkZGRDdBNC1EN0FGRDdDNy1EN0NBRDdGQy1GOEZGRkE2RUZBNkZGQURBLUZBRkZGQjA3LUZCMTJGQjE4LUZCMUNGQjM3RkIzREZCM0ZGQjQyRkI0NUZCQzItRkJEMkZENDAtRkQ0RkZEOTBGRDkxRkRDOC1GREVGRkRGRUZERkZGRTFBLUZFMUZGRTI3LUZFMkZGRTUzRkU2N0ZFNkMtRkU2RkZFNzVGRUZELUZGMDBGRkJGLUZGQzFGRkM4RkZDOUZGRDBGRkQxRkZEOEZGRDlGRkRELUZGREZGRkU3RkZFRi1GRkZCRkZGRUZGRkZcIixcclxuICAgICAgICBDYzogXCIwMDAwLTAwMUYwMDdGLTAwOUZcIixcclxuICAgICAgICBDZjogXCIwMEFEMDYwMC0wNjA0MDZERDA3MEYyMDBCLTIwMEYyMDJBLTIwMkUyMDYwLTIwNjQyMDZBLTIwNkZGRUZGRkZGOS1GRkZCXCIsXHJcbiAgICAgICAgQ286IFwiRTAwMC1GOEZGXCIsXHJcbiAgICAgICAgQ3M6IFwiRDgwMC1ERkZGXCIsXHJcbiAgICAgICAgQ246IFwiMDM3ODAzNzkwMzdGLTAzODMwMzhCMDM4RDAzQTIwNTI4LTA1MzAwNTU3MDU1ODA1NjAwNTg4MDU4Qi0wNThFMDU5MDA1QzgtMDVDRjA1RUItMDVFRjA1RjUtMDVGRjA2MDUwNjFDMDYxRDA3MEUwNzRCMDc0QzA3QjItMDdCRjA3RkItMDdGRjA4MkUwODJGMDgzRjA4NUMwODVEMDg1Ri0wODlGMDhBMTA4QUQtMDhFMzA4RkYwOTc4MDk4MDA5ODQwOThEMDk4RTA5OTEwOTkyMDlBOTA5QjEwOUIzLTA5QjUwOUJBMDlCQjA5QzUwOUM2MDlDOTA5Q0EwOUNGLTA5RDYwOUQ4LTA5REIwOURFMDlFNDA5RTUwOUZDLTBBMDAwQTA0MEEwQi0wQTBFMEExMTBBMTIwQTI5MEEzMTBBMzQwQTM3MEEzQTBBM0IwQTNEMEE0My0wQTQ2MEE0OTBBNEEwQTRFLTBBNTAwQTUyLTBBNTgwQTVEMEE1Ri0wQTY1MEE3Ni0wQTgwMEE4NDBBOEUwQTkyMEFBOTBBQjEwQUI0MEFCQTBBQkIwQUM2MEFDQTBBQ0UwQUNGMEFEMS0wQURGMEFFNDBBRTUwQUYyLTBCMDAwQjA0MEIwRDBCMEUwQjExMEIxMjBCMjkwQjMxMEIzNDBCM0EwQjNCMEI0NTBCNDYwQjQ5MEI0QTBCNEUtMEI1NTBCNTgtMEI1QjBCNUUwQjY0MEI2NTBCNzgtMEI4MTBCODQwQjhCLTBCOEQwQjkxMEI5Ni0wQjk4MEI5QjBCOUQwQkEwLTBCQTIwQkE1LTBCQTcwQkFCLTBCQUQwQkJBLTBCQkQwQkMzLTBCQzUwQkM5MEJDRTBCQ0YwQkQxLTBCRDYwQkQ4LTBCRTUwQkZCLTBDMDAwQzA0MEMwRDBDMTEwQzI5MEMzNDBDM0EtMEMzQzBDNDUwQzQ5MEM0RS0wQzU0MEM1NzBDNUEtMEM1RjBDNjQwQzY1MEM3MC0wQzc3MEM4MDBDODEwQzg0MEM4RDBDOTEwQ0E5MENCNDBDQkEwQ0JCMENDNTBDQzkwQ0NFLTBDRDQwQ0Q3LTBDREQwQ0RGMENFNDBDRTUwQ0YwMENGMy0wRDAxMEQwNDBEMEQwRDExMEQzQjBEM0MwRDQ1MEQ0OTBENEYtMEQ1NjBENTgtMEQ1RjBENjQwRDY1MEQ3Ni0wRDc4MEQ4MDBEODEwRDg0MEQ5Ny0wRDk5MERCMjBEQkMwREJFMERCRjBEQzctMERDOTBEQ0ItMERDRTBERDUwREQ3MERFMC0wREYxMERGNS0wRTAwMEUzQi0wRTNFMEU1Qy0wRTgwMEU4MzBFODUwRTg2MEU4OTBFOEIwRThDMEU4RS0wRTkzMEU5ODBFQTAwRUE0MEVBNjBFQTgwRUE5MEVBQzBFQkEwRUJFMEVCRjBFQzUwRUM3MEVDRTBFQ0YwRURBMEVEQjBFRTAtMEVGRjBGNDgwRjZELTBGNzAwRjk4MEZCRDBGQ0QwRkRCLTBGRkYxMEM2MTBDOC0xMENDMTBDRTEwQ0YxMjQ5MTI0RTEyNEYxMjU3MTI1OTEyNUUxMjVGMTI4OTEyOEUxMjhGMTJCMTEyQjYxMkI3MTJCRjEyQzExMkM2MTJDNzEyRDcxMzExMTMxNjEzMTcxMzVCMTM1QzEzN0QtMTM3RjEzOUEtMTM5RjEzRjUtMTNGRjE2OUQtMTY5RjE2RjEtMTZGRjE3MEQxNzE1LTE3MUYxNzM3LTE3M0YxNzU0LTE3NUYxNzZEMTc3MTE3NzQtMTc3RjE3REUxN0RGMTdFQS0xN0VGMTdGQS0xN0ZGMTgwRjE4MUEtMTgxRjE4NzgtMTg3RjE4QUItMThBRjE4RjYtMThGRjE5MUQtMTkxRjE5MkMtMTkyRjE5M0MtMTkzRjE5NDEtMTk0MzE5NkUxOTZGMTk3NS0xOTdGMTlBQy0xOUFGMTlDQS0xOUNGMTlEQi0xOUREMUExQzFBMUQxQTVGMUE3RDFBN0UxQThBLTFBOEYxQTlBLTFBOUYxQUFFLTFBRkYxQjRDLTFCNEYxQjdELTFCN0YxQkY0LTFCRkIxQzM4LTFDM0ExQzRBLTFDNEMxQzgwLTFDQkYxQ0M4LTFDQ0YxQ0Y3LTFDRkYxREU3LTFERkIxRjE2MUYxNzFGMUUxRjFGMUY0NjFGNDcxRjRFMUY0RjFGNTgxRjVBMUY1QzFGNUUxRjdFMUY3RjFGQjUxRkM1MUZENDFGRDUxRkRDMUZGMDFGRjExRkY1MUZGRjIwNjUtMjA2OTIwNzIyMDczMjA4RjIwOUQtMjA5RjIwQkEtMjBDRjIwRjEtMjBGRjIxOEEtMjE4RjIzRjQtMjNGRjI0MjctMjQzRjI0NEItMjQ1RjI3MDAyQjRELTJCNEYyQjVBLTJCRkYyQzJGMkM1RjJDRjQtMkNGODJEMjYyRDI4LTJEMkMyRDJFMkQyRjJENjgtMkQ2RTJENzEtMkQ3RTJEOTctMkQ5RjJEQTcyREFGMkRCNzJEQkYyREM3MkRDRjJERDcyRERGMkUzQy0yRTdGMkU5QTJFRjQtMkVGRjJGRDYtMkZFRjJGRkMtMkZGRjMwNDAzMDk3MzA5ODMxMDAtMzEwNDMxMkUtMzEzMDMxOEYzMUJCLTMxQkYzMUU0LTMxRUYzMjFGMzJGRjREQjYtNERCRjlGQ0QtOUZGRkE0OEQtQTQ4RkE0QzctQTRDRkE2MkMtQTYzRkE2OTgtQTY5RUE2RjgtQTZGRkE3OEZBNzk0LUE3OUZBN0FCLUE3RjdBODJDLUE4MkZBODNBLUE4M0ZBODc4LUE4N0ZBOEM1LUE4Q0RBOERBLUE4REZBOEZDLUE4RkZBOTU0LUE5NUVBOTdELUE5N0ZBOUNFQTlEQS1BOUREQTlFMC1BOUZGQUEzNy1BQTNGQUE0RUFBNEZBQTVBQUE1QkFBN0MtQUE3RkFBQzMtQUFEQUFBRjctQUIwMEFCMDdBQjA4QUIwRkFCMTBBQjE3LUFCMUZBQjI3QUIyRi1BQkJGQUJFRUFCRUZBQkZBLUFCRkZEN0E0LUQ3QUZEN0M3LUQ3Q0FEN0ZDLUQ3RkZGQTZFRkE2RkZBREEtRkFGRkZCMDctRkIxMkZCMTgtRkIxQ0ZCMzdGQjNERkIzRkZCNDJGQjQ1RkJDMi1GQkQyRkQ0MC1GRDRGRkQ5MEZEOTFGREM4LUZERUZGREZFRkRGRkZFMUEtRkUxRkZFMjctRkUyRkZFNTNGRTY3RkU2Qy1GRTZGRkU3NUZFRkRGRUZFRkYwMEZGQkYtRkZDMUZGQzhGRkM5RkZEMEZGRDFGRkQ4RkZEOUZGREQtRkZERkZGRTdGRkVGLUZGRjhGRkZFRkZGRlwiXHJcbiAgICB9LCB7XHJcbiAgICAgICAgLy9MOiBcIkxldHRlclwiLCAvLyBJbmNsdWRlZCBpbiB0aGUgVW5pY29kZSBCYXNlIGFkZG9uXHJcbiAgICAgICAgTGw6IFwiTG93ZXJjYXNlX0xldHRlclwiLFxyXG4gICAgICAgIEx1OiBcIlVwcGVyY2FzZV9MZXR0ZXJcIixcclxuICAgICAgICBMdDogXCJUaXRsZWNhc2VfTGV0dGVyXCIsXHJcbiAgICAgICAgTG06IFwiTW9kaWZpZXJfTGV0dGVyXCIsXHJcbiAgICAgICAgTG86IFwiT3RoZXJfTGV0dGVyXCIsXHJcbiAgICAgICAgTTogXCJNYXJrXCIsXHJcbiAgICAgICAgTW46IFwiTm9uc3BhY2luZ19NYXJrXCIsXHJcbiAgICAgICAgTWM6IFwiU3BhY2luZ19NYXJrXCIsXHJcbiAgICAgICAgTWU6IFwiRW5jbG9zaW5nX01hcmtcIixcclxuICAgICAgICBOOiBcIk51bWJlclwiLFxyXG4gICAgICAgIE5kOiBcIkRlY2ltYWxfTnVtYmVyXCIsXHJcbiAgICAgICAgTmw6IFwiTGV0dGVyX051bWJlclwiLFxyXG4gICAgICAgIE5vOiBcIk90aGVyX051bWJlclwiLFxyXG4gICAgICAgIFA6IFwiUHVuY3R1YXRpb25cIixcclxuICAgICAgICBQZDogXCJEYXNoX1B1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUHM6IFwiT3Blbl9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBlOiBcIkNsb3NlX1B1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUGk6IFwiSW5pdGlhbF9QdW5jdHVhdGlvblwiLFxyXG4gICAgICAgIFBmOiBcIkZpbmFsX1B1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUGM6IFwiQ29ubmVjdG9yX1B1bmN0dWF0aW9uXCIsXHJcbiAgICAgICAgUG86IFwiT3RoZXJfUHVuY3R1YXRpb25cIixcclxuICAgICAgICBTOiBcIlN5bWJvbFwiLFxyXG4gICAgICAgIFNtOiBcIk1hdGhfU3ltYm9sXCIsXHJcbiAgICAgICAgU2M6IFwiQ3VycmVuY3lfU3ltYm9sXCIsXHJcbiAgICAgICAgU2s6IFwiTW9kaWZpZXJfU3ltYm9sXCIsXHJcbiAgICAgICAgU286IFwiT3RoZXJfU3ltYm9sXCIsXHJcbiAgICAgICAgWjogXCJTZXBhcmF0b3JcIixcclxuICAgICAgICBaczogXCJTcGFjZV9TZXBhcmF0b3JcIixcclxuICAgICAgICBabDogXCJMaW5lX1NlcGFyYXRvclwiLFxyXG4gICAgICAgIFpwOiBcIlBhcmFncmFwaF9TZXBhcmF0b3JcIixcclxuICAgICAgICBDOiBcIk90aGVyXCIsXHJcbiAgICAgICAgQ2M6IFwiQ29udHJvbFwiLFxyXG4gICAgICAgIENmOiBcIkZvcm1hdFwiLFxyXG4gICAgICAgIENvOiBcIlByaXZhdGVfVXNlXCIsXHJcbiAgICAgICAgQ3M6IFwiU3Vycm9nYXRlXCIsXHJcbiAgICAgICAgQ246IFwiVW5hc3NpZ25lZFwiXHJcbiAgICB9KTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogdW5pY29kZS1zY3JpcHRzLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCBVbmljb2RlIFNjcmlwdHMgdjEuMi4wXHJcbiAqIChjKSAyMDEwLTIwMTIgU3RldmVuIExldml0aGFuIDxodHRwOi8veHJlZ2V4cC5jb20vPlxyXG4gKiBNSVQgTGljZW5zZVxyXG4gKiBVc2VzIFVuaWNvZGUgNi4xIDxodHRwOi8vdW5pY29kZS5vcmcvPlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHN1cHBvcnQgZm9yIGFsbCBVbmljb2RlIHNjcmlwdHMgaW4gdGhlIEJhc2ljIE11bHRpbGluZ3VhbCBQbGFuZSAoVSswMDAwLVUrRkZGRikuXHJcbiAqIEUuZy4sIGBcXHB7TGF0aW59YC4gVG9rZW4gbmFtZXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBhbnkgc3BhY2VzLCBoeXBoZW5zLCBhbmQgdW5kZXJzY29yZXNcclxuICogYXJlIGlnbm9yZWQuXHJcbiAqIEByZXF1aXJlcyBYUmVnRXhwLCBYUmVnRXhwIFVuaWNvZGUgQmFzZVxyXG4gKi9cclxuKGZ1bmN0aW9uIChYUmVnRXhwKSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICBpZiAoIVhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2UpIHtcclxuICAgICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJVbmljb2RlIEJhc2UgbXVzdCBiZSBsb2FkZWQgYmVmb3JlIFVuaWNvZGUgU2NyaXB0c1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBYUmVnRXhwLmluc3RhbGwoXCJleHRlbnNpYmlsaXR5XCIpO1xyXG5cclxuICAgIFhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2Uoe1xyXG4gICAgICAgIEFyYWJpYzogXCIwNjAwLTA2MDQwNjA2LTA2MEIwNjBELTA2MUEwNjFFMDYyMC0wNjNGMDY0MS0wNjRBMDY1Ni0wNjVFMDY2QS0wNjZGMDY3MS0wNkRDMDZERS0wNkZGMDc1MC0wNzdGMDhBMDA4QTItMDhBQzA4RTQtMDhGRUZCNTAtRkJDMUZCRDMtRkQzREZENTAtRkQ4RkZEOTItRkRDN0ZERjAtRkRGQ0ZFNzAtRkU3NEZFNzYtRkVGQ1wiLFxyXG4gICAgICAgIEFybWVuaWFuOiBcIjA1MzEtMDU1NjA1NTktMDU1RjA1NjEtMDU4NzA1OEEwNThGRkIxMy1GQjE3XCIsXHJcbiAgICAgICAgQmFsaW5lc2U6IFwiMUIwMC0xQjRCMUI1MC0xQjdDXCIsXHJcbiAgICAgICAgQmFtdW06IFwiQTZBMC1BNkY3XCIsXHJcbiAgICAgICAgQmF0YWs6IFwiMUJDMC0xQkYzMUJGQy0xQkZGXCIsXHJcbiAgICAgICAgQmVuZ2FsaTogXCIwOTgxLTA5ODMwOTg1LTA5OEMwOThGMDk5MDA5OTMtMDlBODA5QUEtMDlCMDA5QjIwOUI2LTA5QjkwOUJDLTA5QzQwOUM3MDlDODA5Q0ItMDlDRTA5RDcwOURDMDlERDA5REYtMDlFMzA5RTYtMDlGQlwiLFxyXG4gICAgICAgIEJvcG9tb2ZvOiBcIjAyRUEwMkVCMzEwNS0zMTJEMzFBMC0zMUJBXCIsXHJcbiAgICAgICAgQnJhaWxsZTogXCIyODAwLTI4RkZcIixcclxuICAgICAgICBCdWdpbmVzZTogXCIxQTAwLTFBMUIxQTFFMUExRlwiLFxyXG4gICAgICAgIEJ1aGlkOiBcIjE3NDAtMTc1M1wiLFxyXG4gICAgICAgIENhbmFkaWFuX0Fib3JpZ2luYWw6IFwiMTQwMC0xNjdGMThCMC0xOEY1XCIsXHJcbiAgICAgICAgQ2hhbTogXCJBQTAwLUFBMzZBQTQwLUFBNERBQTUwLUFBNTlBQTVDLUFBNUZcIixcclxuICAgICAgICBDaGVyb2tlZTogXCIxM0EwLTEzRjRcIixcclxuICAgICAgICBDb21tb246IFwiMDAwMC0wMDQwMDA1Qi0wMDYwMDA3Qi0wMEE5MDBBQi0wMEI5MDBCQi0wMEJGMDBENzAwRjcwMkI5LTAyREYwMkU1LTAyRTkwMkVDLTAyRkYwMzc0MDM3RTAzODUwMzg3MDU4OTA2MEMwNjFCMDYxRjA2NDAwNjYwLTA2NjkwNkREMDk2NDA5NjUwRTNGMEZENS0wRkQ4MTBGQjE2RUItMTZFRDE3MzUxNzM2MTgwMjE4MDMxODA1MUNEMzFDRTExQ0U5LTFDRUMxQ0VFLTFDRjMxQ0Y1MUNGNjIwMDAtMjAwQjIwMEUtMjA2NDIwNkEtMjA3MDIwNzQtMjA3RTIwODAtMjA4RTIwQTAtMjBCOTIxMDAtMjEyNTIxMjctMjEyOTIxMkMtMjEzMTIxMzMtMjE0RDIxNEYtMjE1RjIxODkyMTkwLTIzRjMyNDAwLTI0MjYyNDQwLTI0NEEyNDYwLTI2RkYyNzAxLTI3RkYyOTAwLTJCNEMyQjUwLTJCNTkyRTAwLTJFM0IyRkYwLTJGRkIzMDAwLTMwMDQzMDA2MzAwOC0zMDIwMzAzMC0zMDM3MzAzQy0zMDNGMzA5QjMwOUMzMEEwMzBGQjMwRkMzMTkwLTMxOUYzMUMwLTMxRTMzMjIwLTMyNUYzMjdGLTMyQ0YzMzU4LTMzRkY0REMwLTRERkZBNzAwLUE3MjFBNzg4LUE3OEFBODMwLUE4MzlGRDNFRkQzRkZERkRGRTEwLUZFMTlGRTMwLUZFNTJGRTU0LUZFNjZGRTY4LUZFNkJGRUZGRkYwMS1GRjIwRkYzQi1GRjQwRkY1Qi1GRjY1RkY3MEZGOUVGRjlGRkZFMC1GRkU2RkZFOC1GRkVFRkZGOS1GRkZEXCIsXHJcbiAgICAgICAgQ29wdGljOiBcIjAzRTItMDNFRjJDODAtMkNGMzJDRjktMkNGRlwiLFxyXG4gICAgICAgIEN5cmlsbGljOiBcIjA0MDAtMDQ4NDA0ODctMDUyNzFEMkIxRDc4MkRFMC0yREZGQTY0MC1BNjk3QTY5RlwiLFxyXG4gICAgICAgIERldmFuYWdhcmk6IFwiMDkwMC0wOTUwMDk1My0wOTYzMDk2Ni0wOTc3MDk3OS0wOTdGQThFMC1BOEZCXCIsXHJcbiAgICAgICAgRXRoaW9waWM6IFwiMTIwMC0xMjQ4MTI0QS0xMjREMTI1MC0xMjU2MTI1ODEyNUEtMTI1RDEyNjAtMTI4ODEyOEEtMTI4RDEyOTAtMTJCMDEyQjItMTJCNTEyQjgtMTJCRTEyQzAxMkMyLTEyQzUxMkM4LTEyRDYxMkQ4LTEzMTAxMzEyLTEzMTUxMzE4LTEzNUExMzVELTEzN0MxMzgwLTEzOTkyRDgwLTJEOTYyREEwLTJEQTYyREE4LTJEQUUyREIwLTJEQjYyREI4LTJEQkUyREMwLTJEQzYyREM4LTJEQ0UyREQwLTJERDYyREQ4LTJEREVBQjAxLUFCMDZBQjA5LUFCMEVBQjExLUFCMTZBQjIwLUFCMjZBQjI4LUFCMkVcIixcclxuICAgICAgICBHZW9yZ2lhbjogXCIxMEEwLTEwQzUxMEM3MTBDRDEwRDAtMTBGQTEwRkMtMTBGRjJEMDAtMkQyNTJEMjcyRDJEXCIsXHJcbiAgICAgICAgR2xhZ29saXRpYzogXCIyQzAwLTJDMkUyQzMwLTJDNUVcIixcclxuICAgICAgICBHcmVlazogXCIwMzcwLTAzNzMwMzc1LTAzNzcwMzdBLTAzN0QwMzg0MDM4NjAzODgtMDM4QTAzOEMwMzhFLTAzQTEwM0EzLTAzRTEwM0YwLTAzRkYxRDI2LTFEMkExRDVELTFENjExRDY2LTFENkExREJGMUYwMC0xRjE1MUYxOC0xRjFEMUYyMC0xRjQ1MUY0OC0xRjREMUY1MC0xRjU3MUY1OTFGNUIxRjVEMUY1Ri0xRjdEMUY4MC0xRkI0MUZCNi0xRkM0MUZDNi0xRkQzMUZENi0xRkRCMUZERC0xRkVGMUZGMi0xRkY0MUZGNi0xRkZFMjEyNlwiLFxyXG4gICAgICAgIEd1amFyYXRpOiBcIjBBODEtMEE4MzBBODUtMEE4RDBBOEYtMEE5MTBBOTMtMEFBODBBQUEtMEFCMDBBQjIwQUIzMEFCNS0wQUI5MEFCQy0wQUM1MEFDNy0wQUM5MEFDQi0wQUNEMEFEMDBBRTAtMEFFMzBBRTYtMEFGMVwiLFxyXG4gICAgICAgIEd1cm11a2hpOiBcIjBBMDEtMEEwMzBBMDUtMEEwQTBBMEYwQTEwMEExMy0wQTI4MEEyQS0wQTMwMEEzMjBBMzMwQTM1MEEzNjBBMzgwQTM5MEEzQzBBM0UtMEE0MjBBNDcwQTQ4MEE0Qi0wQTREMEE1MTBBNTktMEE1QzBBNUUwQTY2LTBBNzVcIixcclxuICAgICAgICBIYW46IFwiMkU4MC0yRTk5MkU5Qi0yRUYzMkYwMC0yRkQ1MzAwNTMwMDczMDIxLTMwMjkzMDM4LTMwM0IzNDAwLTREQjU0RTAwLTlGQ0NGOTAwLUZBNkRGQTcwLUZBRDlcIixcclxuICAgICAgICBIYW5ndWw6IFwiMTEwMC0xMUZGMzAyRTMwMkYzMTMxLTMxOEUzMjAwLTMyMUUzMjYwLTMyN0VBOTYwLUE5N0NBQzAwLUQ3QTNEN0IwLUQ3QzZEN0NCLUQ3RkJGRkEwLUZGQkVGRkMyLUZGQzdGRkNBLUZGQ0ZGRkQyLUZGRDdGRkRBLUZGRENcIixcclxuICAgICAgICBIYW51bm9vOiBcIjE3MjAtMTczNFwiLFxyXG4gICAgICAgIEhlYnJldzogXCIwNTkxLTA1QzcwNUQwLTA1RUEwNUYwLTA1RjRGQjFELUZCMzZGQjM4LUZCM0NGQjNFRkI0MEZCNDFGQjQzRkI0NEZCNDYtRkI0RlwiLFxyXG4gICAgICAgIEhpcmFnYW5hOiBcIjMwNDEtMzA5NjMwOUQtMzA5RlwiLFxyXG4gICAgICAgIEluaGVyaXRlZDogXCIwMzAwLTAzNkYwNDg1MDQ4NjA2NEItMDY1NTA2NUYwNjcwMDk1MTA5NTIxQ0QwLTFDRDIxQ0Q0LTFDRTAxQ0UyLTFDRTgxQ0VEMUNGNDFEQzAtMURFNjFERkMtMURGRjIwMEMyMDBEMjBEMC0yMEYwMzAyQS0zMDJEMzA5OTMwOUFGRTAwLUZFMEZGRTIwLUZFMjZcIixcclxuICAgICAgICBKYXZhbmVzZTogXCJBOTgwLUE5Q0RBOUNGLUE5RDlBOURFQTlERlwiLFxyXG4gICAgICAgIEthbm5hZGE6IFwiMEM4MjBDODMwQzg1LTBDOEMwQzhFLTBDOTAwQzkyLTBDQTgwQ0FBLTBDQjMwQ0I1LTBDQjkwQ0JDLTBDQzQwQ0M2LTBDQzgwQ0NBLTBDQ0QwQ0Q1MENENjBDREUwQ0UwLTBDRTMwQ0U2LTBDRUYwQ0YxMENGMlwiLFxyXG4gICAgICAgIEthdGFrYW5hOiBcIjMwQTEtMzBGQTMwRkQtMzBGRjMxRjAtMzFGRjMyRDAtMzJGRTMzMDAtMzM1N0ZGNjYtRkY2RkZGNzEtRkY5RFwiLFxyXG4gICAgICAgIEtheWFoX0xpOiBcIkE5MDAtQTkyRlwiLFxyXG4gICAgICAgIEtobWVyOiBcIjE3ODAtMTdERDE3RTAtMTdFOTE3RjAtMTdGOTE5RTAtMTlGRlwiLFxyXG4gICAgICAgIExhbzogXCIwRTgxMEU4MjBFODQwRTg3MEU4ODBFOEEwRThEMEU5NC0wRTk3MEU5OS0wRTlGMEVBMS0wRUEzMEVBNTBFQTcwRUFBMEVBQjBFQUQtMEVCOTBFQkItMEVCRDBFQzAtMEVDNDBFQzYwRUM4LTBFQ0QwRUQwLTBFRDkwRURDLTBFREZcIixcclxuICAgICAgICBMYXRpbjogXCIwMDQxLTAwNUEwMDYxLTAwN0EwMEFBMDBCQTAwQzAtMDBENjAwRDgtMDBGNjAwRjgtMDJCODAyRTAtMDJFNDFEMDAtMUQyNTFEMkMtMUQ1QzFENjItMUQ2NTFENkItMUQ3NzFENzktMURCRTFFMDAtMUVGRjIwNzEyMDdGMjA5MC0yMDlDMjEyQTIxMkIyMTMyMjE0RTIxNjAtMjE4ODJDNjAtMkM3RkE3MjItQTc4N0E3OEItQTc4RUE3OTAtQTc5M0E3QTAtQTdBQUE3RjgtQTdGRkZCMDAtRkIwNkZGMjEtRkYzQUZGNDEtRkY1QVwiLFxyXG4gICAgICAgIExlcGNoYTogXCIxQzAwLTFDMzcxQzNCLTFDNDkxQzRELTFDNEZcIixcclxuICAgICAgICBMaW1idTogXCIxOTAwLTE5MUMxOTIwLTE5MkIxOTMwLTE5M0IxOTQwMTk0NC0xOTRGXCIsXHJcbiAgICAgICAgTGlzdTogXCJBNEQwLUE0RkZcIixcclxuICAgICAgICBNYWxheWFsYW06IFwiMEQwMjBEMDMwRDA1LTBEMEMwRDBFLTBEMTAwRDEyLTBEM0EwRDNELTBENDQwRDQ2LTBENDgwRDRBLTBENEUwRDU3MEQ2MC0wRDYzMEQ2Ni0wRDc1MEQ3OS0wRDdGXCIsXHJcbiAgICAgICAgTWFuZGFpYzogXCIwODQwLTA4NUIwODVFXCIsXHJcbiAgICAgICAgTWVldGVpX01heWVrOiBcIkFBRTAtQUFGNkFCQzAtQUJFREFCRjAtQUJGOVwiLFxyXG4gICAgICAgIE1vbmdvbGlhbjogXCIxODAwMTgwMTE4MDQxODA2LTE4MEUxODEwLTE4MTkxODIwLTE4NzcxODgwLTE4QUFcIixcclxuICAgICAgICBNeWFubWFyOiBcIjEwMDAtMTA5RkFBNjAtQUE3QlwiLFxyXG4gICAgICAgIE5ld19UYWlfTHVlOiBcIjE5ODAtMTlBQjE5QjAtMTlDOTE5RDAtMTlEQTE5REUxOURGXCIsXHJcbiAgICAgICAgTmtvOiBcIjA3QzAtMDdGQVwiLFxyXG4gICAgICAgIE9naGFtOiBcIjE2ODAtMTY5Q1wiLFxyXG4gICAgICAgIE9sX0NoaWtpOiBcIjFDNTAtMUM3RlwiLFxyXG4gICAgICAgIE9yaXlhOiBcIjBCMDEtMEIwMzBCMDUtMEIwQzBCMEYwQjEwMEIxMy0wQjI4MEIyQS0wQjMwMEIzMjBCMzMwQjM1LTBCMzkwQjNDLTBCNDQwQjQ3MEI0ODBCNEItMEI0RDBCNTYwQjU3MEI1QzBCNUQwQjVGLTBCNjMwQjY2LTBCNzdcIixcclxuICAgICAgICBQaGFnc19QYTogXCJBODQwLUE4NzdcIixcclxuICAgICAgICBSZWphbmc6IFwiQTkzMC1BOTUzQTk1RlwiLFxyXG4gICAgICAgIFJ1bmljOiBcIjE2QTAtMTZFQTE2RUUtMTZGMFwiLFxyXG4gICAgICAgIFNhbWFyaXRhbjogXCIwODAwLTA4MkQwODMwLTA4M0VcIixcclxuICAgICAgICBTYXVyYXNodHJhOiBcIkE4ODAtQThDNEE4Q0UtQThEOVwiLFxyXG4gICAgICAgIFNpbmhhbGE6IFwiMEQ4MjBEODMwRDg1LTBEOTYwRDlBLTBEQjEwREIzLTBEQkIwREJEMERDMC0wREM2MERDQTBEQ0YtMERENDBERDYwREQ4LTBEREYwREYyLTBERjRcIixcclxuICAgICAgICBTdW5kYW5lc2U6IFwiMUI4MC0xQkJGMUNDMC0xQ0M3XCIsXHJcbiAgICAgICAgU3lsb3RpX05hZ3JpOiBcIkE4MDAtQTgyQlwiLFxyXG4gICAgICAgIFN5cmlhYzogXCIwNzAwLTA3MEQwNzBGLTA3NEEwNzRELTA3NEZcIixcclxuICAgICAgICBUYWdhbG9nOiBcIjE3MDAtMTcwQzE3MEUtMTcxNFwiLFxyXG4gICAgICAgIFRhZ2JhbndhOiBcIjE3NjAtMTc2QzE3NkUtMTc3MDE3NzIxNzczXCIsXHJcbiAgICAgICAgVGFpX0xlOiBcIjE5NTAtMTk2RDE5NzAtMTk3NFwiLFxyXG4gICAgICAgIFRhaV9UaGFtOiBcIjFBMjAtMUE1RTFBNjAtMUE3QzFBN0YtMUE4OTFBOTAtMUE5OTFBQTAtMUFBRFwiLFxyXG4gICAgICAgIFRhaV9WaWV0OiBcIkFBODAtQUFDMkFBREItQUFERlwiLFxyXG4gICAgICAgIFRhbWlsOiBcIjBCODIwQjgzMEI4NS0wQjhBMEI4RS0wQjkwMEI5Mi0wQjk1MEI5OTBCOUEwQjlDMEI5RTBCOUYwQkEzMEJBNDBCQTgtMEJBQTBCQUUtMEJCOTBCQkUtMEJDMjBCQzYtMEJDODBCQ0EtMEJDRDBCRDAwQkQ3MEJFNi0wQkZBXCIsXHJcbiAgICAgICAgVGVsdWd1OiBcIjBDMDEtMEMwMzBDMDUtMEMwQzBDMEUtMEMxMDBDMTItMEMyODBDMkEtMEMzMzBDMzUtMEMzOTBDM0QtMEM0NDBDNDYtMEM0ODBDNEEtMEM0RDBDNTUwQzU2MEM1ODBDNTkwQzYwLTBDNjMwQzY2LTBDNkYwQzc4LTBDN0ZcIixcclxuICAgICAgICBUaGFhbmE6IFwiMDc4MC0wN0IxXCIsXHJcbiAgICAgICAgVGhhaTogXCIwRTAxLTBFM0EwRTQwLTBFNUJcIixcclxuICAgICAgICBUaWJldGFuOiBcIjBGMDAtMEY0NzBGNDktMEY2QzBGNzEtMEY5NzBGOTktMEZCQzBGQkUtMEZDQzBGQ0UtMEZENDBGRDkwRkRBXCIsXHJcbiAgICAgICAgVGlmaW5hZ2g6IFwiMkQzMC0yRDY3MkQ2RjJENzAyRDdGXCIsXHJcbiAgICAgICAgVmFpOiBcIkE1MDAtQTYyQlwiLFxyXG4gICAgICAgIFlpOiBcIkEwMDAtQTQ4Q0E0OTAtQTRDNlwiXHJcbiAgICB9KTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogdW5pY29kZS1ibG9ja3MuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwIFVuaWNvZGUgQmxvY2tzIHYxLjIuMFxyXG4gKiAoYykgMjAxMC0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICogVXNlcyBVbmljb2RlIDYuMSA8aHR0cDovL3VuaWNvZGUub3JnLz5cclxuICovXHJcblxyXG4vKipcclxuICogQWRkcyBzdXBwb3J0IGZvciBhbGwgVW5pY29kZSBibG9ja3MgaW4gdGhlIEJhc2ljIE11bHRpbGluZ3VhbCBQbGFuZSAoVSswMDAwLVUrRkZGRikuIFVuaWNvZGVcclxuICogYmxvY2tzIHVzZSB0aGUgcHJlZml4IFwiSW5cIi4gRS5nLiwgYFxccHtJbkJhc2ljTGF0aW59YC4gVG9rZW4gbmFtZXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBhbnlcclxuICogc3BhY2VzLCBoeXBoZW5zLCBhbmQgdW5kZXJzY29yZXMgYXJlIGlnbm9yZWQuXHJcbiAqIEByZXF1aXJlcyBYUmVnRXhwLCBYUmVnRXhwIFVuaWNvZGUgQmFzZVxyXG4gKi9cclxuKGZ1bmN0aW9uIChYUmVnRXhwKSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICBpZiAoIVhSZWdFeHAuYWRkVW5pY29kZVBhY2thZ2UpIHtcclxuICAgICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJVbmljb2RlIEJhc2UgbXVzdCBiZSBsb2FkZWQgYmVmb3JlIFVuaWNvZGUgQmxvY2tzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIFhSZWdFeHAuaW5zdGFsbChcImV4dGVuc2liaWxpdHlcIik7XHJcblxyXG4gICAgWFJlZ0V4cC5hZGRVbmljb2RlUGFja2FnZSh7XHJcbiAgICAgICAgSW5CYXNpY19MYXRpbjogXCIwMDAwLTAwN0ZcIixcclxuICAgICAgICBJbkxhdGluXzFfU3VwcGxlbWVudDogXCIwMDgwLTAwRkZcIixcclxuICAgICAgICBJbkxhdGluX0V4dGVuZGVkX0E6IFwiMDEwMC0wMTdGXCIsXHJcbiAgICAgICAgSW5MYXRpbl9FeHRlbmRlZF9COiBcIjAxODAtMDI0RlwiLFxyXG4gICAgICAgIEluSVBBX0V4dGVuc2lvbnM6IFwiMDI1MC0wMkFGXCIsXHJcbiAgICAgICAgSW5TcGFjaW5nX01vZGlmaWVyX0xldHRlcnM6IFwiMDJCMC0wMkZGXCIsXHJcbiAgICAgICAgSW5Db21iaW5pbmdfRGlhY3JpdGljYWxfTWFya3M6IFwiMDMwMC0wMzZGXCIsXHJcbiAgICAgICAgSW5HcmVla19hbmRfQ29wdGljOiBcIjAzNzAtMDNGRlwiLFxyXG4gICAgICAgIEluQ3lyaWxsaWM6IFwiMDQwMC0wNEZGXCIsXHJcbiAgICAgICAgSW5DeXJpbGxpY19TdXBwbGVtZW50OiBcIjA1MDAtMDUyRlwiLFxyXG4gICAgICAgIEluQXJtZW5pYW46IFwiMDUzMC0wNThGXCIsXHJcbiAgICAgICAgSW5IZWJyZXc6IFwiMDU5MC0wNUZGXCIsXHJcbiAgICAgICAgSW5BcmFiaWM6IFwiMDYwMC0wNkZGXCIsXHJcbiAgICAgICAgSW5TeXJpYWM6IFwiMDcwMC0wNzRGXCIsXHJcbiAgICAgICAgSW5BcmFiaWNfU3VwcGxlbWVudDogXCIwNzUwLTA3N0ZcIixcclxuICAgICAgICBJblRoYWFuYTogXCIwNzgwLTA3QkZcIixcclxuICAgICAgICBJbk5LbzogXCIwN0MwLTA3RkZcIixcclxuICAgICAgICBJblNhbWFyaXRhbjogXCIwODAwLTA4M0ZcIixcclxuICAgICAgICBJbk1hbmRhaWM6IFwiMDg0MC0wODVGXCIsXHJcbiAgICAgICAgSW5BcmFiaWNfRXh0ZW5kZWRfQTogXCIwOEEwLTA4RkZcIixcclxuICAgICAgICBJbkRldmFuYWdhcmk6IFwiMDkwMC0wOTdGXCIsXHJcbiAgICAgICAgSW5CZW5nYWxpOiBcIjA5ODAtMDlGRlwiLFxyXG4gICAgICAgIEluR3VybXVraGk6IFwiMEEwMC0wQTdGXCIsXHJcbiAgICAgICAgSW5HdWphcmF0aTogXCIwQTgwLTBBRkZcIixcclxuICAgICAgICBJbk9yaXlhOiBcIjBCMDAtMEI3RlwiLFxyXG4gICAgICAgIEluVGFtaWw6IFwiMEI4MC0wQkZGXCIsXHJcbiAgICAgICAgSW5UZWx1Z3U6IFwiMEMwMC0wQzdGXCIsXHJcbiAgICAgICAgSW5LYW5uYWRhOiBcIjBDODAtMENGRlwiLFxyXG4gICAgICAgIEluTWFsYXlhbGFtOiBcIjBEMDAtMEQ3RlwiLFxyXG4gICAgICAgIEluU2luaGFsYTogXCIwRDgwLTBERkZcIixcclxuICAgICAgICBJblRoYWk6IFwiMEUwMC0wRTdGXCIsXHJcbiAgICAgICAgSW5MYW86IFwiMEU4MC0wRUZGXCIsXHJcbiAgICAgICAgSW5UaWJldGFuOiBcIjBGMDAtMEZGRlwiLFxyXG4gICAgICAgIEluTXlhbm1hcjogXCIxMDAwLTEwOUZcIixcclxuICAgICAgICBJbkdlb3JnaWFuOiBcIjEwQTAtMTBGRlwiLFxyXG4gICAgICAgIEluSGFuZ3VsX0phbW86IFwiMTEwMC0xMUZGXCIsXHJcbiAgICAgICAgSW5FdGhpb3BpYzogXCIxMjAwLTEzN0ZcIixcclxuICAgICAgICBJbkV0aGlvcGljX1N1cHBsZW1lbnQ6IFwiMTM4MC0xMzlGXCIsXHJcbiAgICAgICAgSW5DaGVyb2tlZTogXCIxM0EwLTEzRkZcIixcclxuICAgICAgICBJblVuaWZpZWRfQ2FuYWRpYW5fQWJvcmlnaW5hbF9TeWxsYWJpY3M6IFwiMTQwMC0xNjdGXCIsXHJcbiAgICAgICAgSW5PZ2hhbTogXCIxNjgwLTE2OUZcIixcclxuICAgICAgICBJblJ1bmljOiBcIjE2QTAtMTZGRlwiLFxyXG4gICAgICAgIEluVGFnYWxvZzogXCIxNzAwLTE3MUZcIixcclxuICAgICAgICBJbkhhbnVub286IFwiMTcyMC0xNzNGXCIsXHJcbiAgICAgICAgSW5CdWhpZDogXCIxNzQwLTE3NUZcIixcclxuICAgICAgICBJblRhZ2JhbndhOiBcIjE3NjAtMTc3RlwiLFxyXG4gICAgICAgIEluS2htZXI6IFwiMTc4MC0xN0ZGXCIsXHJcbiAgICAgICAgSW5Nb25nb2xpYW46IFwiMTgwMC0xOEFGXCIsXHJcbiAgICAgICAgSW5VbmlmaWVkX0NhbmFkaWFuX0Fib3JpZ2luYWxfU3lsbGFiaWNzX0V4dGVuZGVkOiBcIjE4QjAtMThGRlwiLFxyXG4gICAgICAgIEluTGltYnU6IFwiMTkwMC0xOTRGXCIsXHJcbiAgICAgICAgSW5UYWlfTGU6IFwiMTk1MC0xOTdGXCIsXHJcbiAgICAgICAgSW5OZXdfVGFpX0x1ZTogXCIxOTgwLTE5REZcIixcclxuICAgICAgICBJbktobWVyX1N5bWJvbHM6IFwiMTlFMC0xOUZGXCIsXHJcbiAgICAgICAgSW5CdWdpbmVzZTogXCIxQTAwLTFBMUZcIixcclxuICAgICAgICBJblRhaV9UaGFtOiBcIjFBMjAtMUFBRlwiLFxyXG4gICAgICAgIEluQmFsaW5lc2U6IFwiMUIwMC0xQjdGXCIsXHJcbiAgICAgICAgSW5TdW5kYW5lc2U6IFwiMUI4MC0xQkJGXCIsXHJcbiAgICAgICAgSW5CYXRhazogXCIxQkMwLTFCRkZcIixcclxuICAgICAgICBJbkxlcGNoYTogXCIxQzAwLTFDNEZcIixcclxuICAgICAgICBJbk9sX0NoaWtpOiBcIjFDNTAtMUM3RlwiLFxyXG4gICAgICAgIEluU3VuZGFuZXNlX1N1cHBsZW1lbnQ6IFwiMUNDMC0xQ0NGXCIsXHJcbiAgICAgICAgSW5WZWRpY19FeHRlbnNpb25zOiBcIjFDRDAtMUNGRlwiLFxyXG4gICAgICAgIEluUGhvbmV0aWNfRXh0ZW5zaW9uczogXCIxRDAwLTFEN0ZcIixcclxuICAgICAgICBJblBob25ldGljX0V4dGVuc2lvbnNfU3VwcGxlbWVudDogXCIxRDgwLTFEQkZcIixcclxuICAgICAgICBJbkNvbWJpbmluZ19EaWFjcml0aWNhbF9NYXJrc19TdXBwbGVtZW50OiBcIjFEQzAtMURGRlwiLFxyXG4gICAgICAgIEluTGF0aW5fRXh0ZW5kZWRfQWRkaXRpb25hbDogXCIxRTAwLTFFRkZcIixcclxuICAgICAgICBJbkdyZWVrX0V4dGVuZGVkOiBcIjFGMDAtMUZGRlwiLFxyXG4gICAgICAgIEluR2VuZXJhbF9QdW5jdHVhdGlvbjogXCIyMDAwLTIwNkZcIixcclxuICAgICAgICBJblN1cGVyc2NyaXB0c19hbmRfU3Vic2NyaXB0czogXCIyMDcwLTIwOUZcIixcclxuICAgICAgICBJbkN1cnJlbmN5X1N5bWJvbHM6IFwiMjBBMC0yMENGXCIsXHJcbiAgICAgICAgSW5Db21iaW5pbmdfRGlhY3JpdGljYWxfTWFya3NfZm9yX1N5bWJvbHM6IFwiMjBEMC0yMEZGXCIsXHJcbiAgICAgICAgSW5MZXR0ZXJsaWtlX1N5bWJvbHM6IFwiMjEwMC0yMTRGXCIsXHJcbiAgICAgICAgSW5OdW1iZXJfRm9ybXM6IFwiMjE1MC0yMThGXCIsXHJcbiAgICAgICAgSW5BcnJvd3M6IFwiMjE5MC0yMUZGXCIsXHJcbiAgICAgICAgSW5NYXRoZW1hdGljYWxfT3BlcmF0b3JzOiBcIjIyMDAtMjJGRlwiLFxyXG4gICAgICAgIEluTWlzY2VsbGFuZW91c19UZWNobmljYWw6IFwiMjMwMC0yM0ZGXCIsXHJcbiAgICAgICAgSW5Db250cm9sX1BpY3R1cmVzOiBcIjI0MDAtMjQzRlwiLFxyXG4gICAgICAgIEluT3B0aWNhbF9DaGFyYWN0ZXJfUmVjb2duaXRpb246IFwiMjQ0MC0yNDVGXCIsXHJcbiAgICAgICAgSW5FbmNsb3NlZF9BbHBoYW51bWVyaWNzOiBcIjI0NjAtMjRGRlwiLFxyXG4gICAgICAgIEluQm94X0RyYXdpbmc6IFwiMjUwMC0yNTdGXCIsXHJcbiAgICAgICAgSW5CbG9ja19FbGVtZW50czogXCIyNTgwLTI1OUZcIixcclxuICAgICAgICBJbkdlb21ldHJpY19TaGFwZXM6IFwiMjVBMC0yNUZGXCIsXHJcbiAgICAgICAgSW5NaXNjZWxsYW5lb3VzX1N5bWJvbHM6IFwiMjYwMC0yNkZGXCIsXHJcbiAgICAgICAgSW5EaW5nYmF0czogXCIyNzAwLTI3QkZcIixcclxuICAgICAgICBJbk1pc2NlbGxhbmVvdXNfTWF0aGVtYXRpY2FsX1N5bWJvbHNfQTogXCIyN0MwLTI3RUZcIixcclxuICAgICAgICBJblN1cHBsZW1lbnRhbF9BcnJvd3NfQTogXCIyN0YwLTI3RkZcIixcclxuICAgICAgICBJbkJyYWlsbGVfUGF0dGVybnM6IFwiMjgwMC0yOEZGXCIsXHJcbiAgICAgICAgSW5TdXBwbGVtZW50YWxfQXJyb3dzX0I6IFwiMjkwMC0yOTdGXCIsXHJcbiAgICAgICAgSW5NaXNjZWxsYW5lb3VzX01hdGhlbWF0aWNhbF9TeW1ib2xzX0I6IFwiMjk4MC0yOUZGXCIsXHJcbiAgICAgICAgSW5TdXBwbGVtZW50YWxfTWF0aGVtYXRpY2FsX09wZXJhdG9yczogXCIyQTAwLTJBRkZcIixcclxuICAgICAgICBJbk1pc2NlbGxhbmVvdXNfU3ltYm9sc19hbmRfQXJyb3dzOiBcIjJCMDAtMkJGRlwiLFxyXG4gICAgICAgIEluR2xhZ29saXRpYzogXCIyQzAwLTJDNUZcIixcclxuICAgICAgICBJbkxhdGluX0V4dGVuZGVkX0M6IFwiMkM2MC0yQzdGXCIsXHJcbiAgICAgICAgSW5Db3B0aWM6IFwiMkM4MC0yQ0ZGXCIsXHJcbiAgICAgICAgSW5HZW9yZ2lhbl9TdXBwbGVtZW50OiBcIjJEMDAtMkQyRlwiLFxyXG4gICAgICAgIEluVGlmaW5hZ2g6IFwiMkQzMC0yRDdGXCIsXHJcbiAgICAgICAgSW5FdGhpb3BpY19FeHRlbmRlZDogXCIyRDgwLTJEREZcIixcclxuICAgICAgICBJbkN5cmlsbGljX0V4dGVuZGVkX0E6IFwiMkRFMC0yREZGXCIsXHJcbiAgICAgICAgSW5TdXBwbGVtZW50YWxfUHVuY3R1YXRpb246IFwiMkUwMC0yRTdGXCIsXHJcbiAgICAgICAgSW5DSktfUmFkaWNhbHNfU3VwcGxlbWVudDogXCIyRTgwLTJFRkZcIixcclxuICAgICAgICBJbkthbmd4aV9SYWRpY2FsczogXCIyRjAwLTJGREZcIixcclxuICAgICAgICBJbklkZW9ncmFwaGljX0Rlc2NyaXB0aW9uX0NoYXJhY3RlcnM6IFwiMkZGMC0yRkZGXCIsXHJcbiAgICAgICAgSW5DSktfU3ltYm9sc19hbmRfUHVuY3R1YXRpb246IFwiMzAwMC0zMDNGXCIsXHJcbiAgICAgICAgSW5IaXJhZ2FuYTogXCIzMDQwLTMwOUZcIixcclxuICAgICAgICBJbkthdGFrYW5hOiBcIjMwQTAtMzBGRlwiLFxyXG4gICAgICAgIEluQm9wb21vZm86IFwiMzEwMC0zMTJGXCIsXHJcbiAgICAgICAgSW5IYW5ndWxfQ29tcGF0aWJpbGl0eV9KYW1vOiBcIjMxMzAtMzE4RlwiLFxyXG4gICAgICAgIEluS2FuYnVuOiBcIjMxOTAtMzE5RlwiLFxyXG4gICAgICAgIEluQm9wb21vZm9fRXh0ZW5kZWQ6IFwiMzFBMC0zMUJGXCIsXHJcbiAgICAgICAgSW5DSktfU3Ryb2tlczogXCIzMUMwLTMxRUZcIixcclxuICAgICAgICBJbkthdGFrYW5hX1Bob25ldGljX0V4dGVuc2lvbnM6IFwiMzFGMC0zMUZGXCIsXHJcbiAgICAgICAgSW5FbmNsb3NlZF9DSktfTGV0dGVyc19hbmRfTW9udGhzOiBcIjMyMDAtMzJGRlwiLFxyXG4gICAgICAgIEluQ0pLX0NvbXBhdGliaWxpdHk6IFwiMzMwMC0zM0ZGXCIsXHJcbiAgICAgICAgSW5DSktfVW5pZmllZF9JZGVvZ3JhcGhzX0V4dGVuc2lvbl9BOiBcIjM0MDAtNERCRlwiLFxyXG4gICAgICAgIEluWWlqaW5nX0hleGFncmFtX1N5bWJvbHM6IFwiNERDMC00REZGXCIsXHJcbiAgICAgICAgSW5DSktfVW5pZmllZF9JZGVvZ3JhcGhzOiBcIjRFMDAtOUZGRlwiLFxyXG4gICAgICAgIEluWWlfU3lsbGFibGVzOiBcIkEwMDAtQTQ4RlwiLFxyXG4gICAgICAgIEluWWlfUmFkaWNhbHM6IFwiQTQ5MC1BNENGXCIsXHJcbiAgICAgICAgSW5MaXN1OiBcIkE0RDAtQTRGRlwiLFxyXG4gICAgICAgIEluVmFpOiBcIkE1MDAtQTYzRlwiLFxyXG4gICAgICAgIEluQ3lyaWxsaWNfRXh0ZW5kZWRfQjogXCJBNjQwLUE2OUZcIixcclxuICAgICAgICBJbkJhbXVtOiBcIkE2QTAtQTZGRlwiLFxyXG4gICAgICAgIEluTW9kaWZpZXJfVG9uZV9MZXR0ZXJzOiBcIkE3MDAtQTcxRlwiLFxyXG4gICAgICAgIEluTGF0aW5fRXh0ZW5kZWRfRDogXCJBNzIwLUE3RkZcIixcclxuICAgICAgICBJblN5bG90aV9OYWdyaTogXCJBODAwLUE4MkZcIixcclxuICAgICAgICBJbkNvbW1vbl9JbmRpY19OdW1iZXJfRm9ybXM6IFwiQTgzMC1BODNGXCIsXHJcbiAgICAgICAgSW5QaGFnc19wYTogXCJBODQwLUE4N0ZcIixcclxuICAgICAgICBJblNhdXJhc2h0cmE6IFwiQTg4MC1BOERGXCIsXHJcbiAgICAgICAgSW5EZXZhbmFnYXJpX0V4dGVuZGVkOiBcIkE4RTAtQThGRlwiLFxyXG4gICAgICAgIEluS2F5YWhfTGk6IFwiQTkwMC1BOTJGXCIsXHJcbiAgICAgICAgSW5SZWphbmc6IFwiQTkzMC1BOTVGXCIsXHJcbiAgICAgICAgSW5IYW5ndWxfSmFtb19FeHRlbmRlZF9BOiBcIkE5NjAtQTk3RlwiLFxyXG4gICAgICAgIEluSmF2YW5lc2U6IFwiQTk4MC1BOURGXCIsXHJcbiAgICAgICAgSW5DaGFtOiBcIkFBMDAtQUE1RlwiLFxyXG4gICAgICAgIEluTXlhbm1hcl9FeHRlbmRlZF9BOiBcIkFBNjAtQUE3RlwiLFxyXG4gICAgICAgIEluVGFpX1ZpZXQ6IFwiQUE4MC1BQURGXCIsXHJcbiAgICAgICAgSW5NZWV0ZWlfTWF5ZWtfRXh0ZW5zaW9uczogXCJBQUUwLUFBRkZcIixcclxuICAgICAgICBJbkV0aGlvcGljX0V4dGVuZGVkX0E6IFwiQUIwMC1BQjJGXCIsXHJcbiAgICAgICAgSW5NZWV0ZWlfTWF5ZWs6IFwiQUJDMC1BQkZGXCIsXHJcbiAgICAgICAgSW5IYW5ndWxfU3lsbGFibGVzOiBcIkFDMDAtRDdBRlwiLFxyXG4gICAgICAgIEluSGFuZ3VsX0phbW9fRXh0ZW5kZWRfQjogXCJEN0IwLUQ3RkZcIixcclxuICAgICAgICBJbkhpZ2hfU3Vycm9nYXRlczogXCJEODAwLURCN0ZcIixcclxuICAgICAgICBJbkhpZ2hfUHJpdmF0ZV9Vc2VfU3Vycm9nYXRlczogXCJEQjgwLURCRkZcIixcclxuICAgICAgICBJbkxvd19TdXJyb2dhdGVzOiBcIkRDMDAtREZGRlwiLFxyXG4gICAgICAgIEluUHJpdmF0ZV9Vc2VfQXJlYTogXCJFMDAwLUY4RkZcIixcclxuICAgICAgICBJbkNKS19Db21wYXRpYmlsaXR5X0lkZW9ncmFwaHM6IFwiRjkwMC1GQUZGXCIsXHJcbiAgICAgICAgSW5BbHBoYWJldGljX1ByZXNlbnRhdGlvbl9Gb3JtczogXCJGQjAwLUZCNEZcIixcclxuICAgICAgICBJbkFyYWJpY19QcmVzZW50YXRpb25fRm9ybXNfQTogXCJGQjUwLUZERkZcIixcclxuICAgICAgICBJblZhcmlhdGlvbl9TZWxlY3RvcnM6IFwiRkUwMC1GRTBGXCIsXHJcbiAgICAgICAgSW5WZXJ0aWNhbF9Gb3JtczogXCJGRTEwLUZFMUZcIixcclxuICAgICAgICBJbkNvbWJpbmluZ19IYWxmX01hcmtzOiBcIkZFMjAtRkUyRlwiLFxyXG4gICAgICAgIEluQ0pLX0NvbXBhdGliaWxpdHlfRm9ybXM6IFwiRkUzMC1GRTRGXCIsXHJcbiAgICAgICAgSW5TbWFsbF9Gb3JtX1ZhcmlhbnRzOiBcIkZFNTAtRkU2RlwiLFxyXG4gICAgICAgIEluQXJhYmljX1ByZXNlbnRhdGlvbl9Gb3Jtc19COiBcIkZFNzAtRkVGRlwiLFxyXG4gICAgICAgIEluSGFsZndpZHRoX2FuZF9GdWxsd2lkdGhfRm9ybXM6IFwiRkYwMC1GRkVGXCIsXHJcbiAgICAgICAgSW5TcGVjaWFsczogXCJGRkYwLUZGRkZcIlxyXG4gICAgfSk7XHJcblxyXG59KFhSZWdFeHApKTtcclxuXHJcblxuLyoqKioqIHVuaWNvZGUtcHJvcGVydGllcy5qcyAqKioqKi9cblxuLyohXHJcbiAqIFhSZWdFeHAgVW5pY29kZSBQcm9wZXJ0aWVzIHYxLjAuMFxyXG4gKiAoYykgMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPGh0dHA6Ly94cmVnZXhwLmNvbS8+XHJcbiAqIE1JVCBMaWNlbnNlXHJcbiAqIFVzZXMgVW5pY29kZSA2LjEgPGh0dHA6Ly91bmljb2RlLm9yZy8+XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgVW5pY29kZSBwcm9wZXJ0aWVzIG5lY2Vzc2FyeSB0byBtZWV0IExldmVsIDEgVW5pY29kZSBzdXBwb3J0IChkZXRhaWxlZCBpbiBVVFMjMTggUkwxLjIpLlxyXG4gKiBJbmNsdWRlcyBjb2RlIHBvaW50cyBmcm9tIHRoZSBCYXNpYyBNdWx0aWxpbmd1YWwgUGxhbmUgKFUrMDAwMC1VK0ZGRkYpIG9ubHkuIFRva2VuIG5hbWVzIGFyZVxyXG4gKiBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgYW55IHNwYWNlcywgaHlwaGVucywgYW5kIHVuZGVyc2NvcmVzIGFyZSBpZ25vcmVkLlxyXG4gKiBAcmVxdWlyZXMgWFJlZ0V4cCwgWFJlZ0V4cCBVbmljb2RlIEJhc2VcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaWYgKCFYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiVW5pY29kZSBCYXNlIG11c3QgYmUgbG9hZGVkIGJlZm9yZSBVbmljb2RlIFByb3BlcnRpZXNcIik7XHJcbiAgICB9XHJcblxyXG4gICAgWFJlZ0V4cC5pbnN0YWxsKFwiZXh0ZW5zaWJpbGl0eVwiKTtcclxuXHJcbiAgICBYUmVnRXhwLmFkZFVuaWNvZGVQYWNrYWdlKHtcclxuICAgICAgICBBbHBoYWJldGljOiBcIjAwNDEtMDA1QTAwNjEtMDA3QTAwQUEwMEI1MDBCQTAwQzAtMDBENjAwRDgtMDBGNjAwRjgtMDJDMTAyQzYtMDJEMTAyRTAtMDJFNDAyRUMwMkVFMDM0NTAzNzAtMDM3NDAzNzYwMzc3MDM3QS0wMzdEMDM4NjAzODgtMDM4QTAzOEMwMzhFLTAzQTEwM0EzLTAzRjUwM0Y3LTA0ODEwNDhBLTA1MjcwNTMxLTA1NTYwNTU5MDU2MS0wNTg3MDVCMC0wNUJEMDVCRjA1QzEwNUMyMDVDNDA1QzUwNUM3MDVEMC0wNUVBMDVGMC0wNUYyMDYxMC0wNjFBMDYyMC0wNjU3MDY1OS0wNjVGMDY2RS0wNkQzMDZENS0wNkRDMDZFMS0wNkU4MDZFRC0wNkVGMDZGQS0wNkZDMDZGRjA3MTAtMDczRjA3NEQtMDdCMTA3Q0EtMDdFQTA3RjQwN0Y1MDdGQTA4MDAtMDgxNzA4MUEtMDgyQzA4NDAtMDg1ODA4QTAwOEEyLTA4QUMwOEU0LTA4RTkwOEYwLTA4RkUwOTAwLTA5M0IwOTNELTA5NEMwOTRFLTA5NTAwOTU1LTA5NjMwOTcxLTA5NzcwOTc5LTA5N0YwOTgxLTA5ODMwOTg1LTA5OEMwOThGMDk5MDA5OTMtMDlBODA5QUEtMDlCMDA5QjIwOUI2LTA5QjkwOUJELTA5QzQwOUM3MDlDODA5Q0IwOUNDMDlDRTA5RDcwOURDMDlERDA5REYtMDlFMzA5RjAwOUYxMEEwMS0wQTAzMEEwNS0wQTBBMEEwRjBBMTAwQTEzLTBBMjgwQTJBLTBBMzAwQTMyMEEzMzBBMzUwQTM2MEEzODBBMzkwQTNFLTBBNDIwQTQ3MEE0ODBBNEIwQTRDMEE1MTBBNTktMEE1QzBBNUUwQTcwLTBBNzUwQTgxLTBBODMwQTg1LTBBOEQwQThGLTBBOTEwQTkzLTBBQTgwQUFBLTBBQjAwQUIyMEFCMzBBQjUtMEFCOTBBQkQtMEFDNTBBQzctMEFDOTBBQ0IwQUNDMEFEMDBBRTAtMEFFMzBCMDEtMEIwMzBCMDUtMEIwQzBCMEYwQjEwMEIxMy0wQjI4MEIyQS0wQjMwMEIzMjBCMzMwQjM1LTBCMzkwQjNELTBCNDQwQjQ3MEI0ODBCNEIwQjRDMEI1NjBCNTcwQjVDMEI1RDBCNUYtMEI2MzBCNzEwQjgyMEI4MzBCODUtMEI4QTBCOEUtMEI5MDBCOTItMEI5NTBCOTkwQjlBMEI5QzBCOUUwQjlGMEJBMzBCQTQwQkE4LTBCQUEwQkFFLTBCQjkwQkJFLTBCQzIwQkM2LTBCQzgwQkNBLTBCQ0MwQkQwMEJENzBDMDEtMEMwMzBDMDUtMEMwQzBDMEUtMEMxMDBDMTItMEMyODBDMkEtMEMzMzBDMzUtMEMzOTBDM0QtMEM0NDBDNDYtMEM0ODBDNEEtMEM0QzBDNTUwQzU2MEM1ODBDNTkwQzYwLTBDNjMwQzgyMEM4MzBDODUtMEM4QzBDOEUtMEM5MDBDOTItMENBODBDQUEtMENCMzBDQjUtMENCOTBDQkQtMENDNDBDQzYtMENDODBDQ0EtMENDQzBDRDUwQ0Q2MENERTBDRTAtMENFMzBDRjEwQ0YyMEQwMjBEMDMwRDA1LTBEMEMwRDBFLTBEMTAwRDEyLTBEM0EwRDNELTBENDQwRDQ2LTBENDgwRDRBLTBENEMwRDRFMEQ1NzBENjAtMEQ2MzBEN0EtMEQ3RjBEODIwRDgzMEQ4NS0wRDk2MEQ5QS0wREIxMERCMy0wREJCMERCRDBEQzAtMERDNjBEQ0YtMERENDBERDYwREQ4LTBEREYwREYyMERGMzBFMDEtMEUzQTBFNDAtMEU0NjBFNEQwRTgxMEU4MjBFODQwRTg3MEU4ODBFOEEwRThEMEU5NC0wRTk3MEU5OS0wRTlGMEVBMS0wRUEzMEVBNTBFQTcwRUFBMEVBQjBFQUQtMEVCOTBFQkItMEVCRDBFQzAtMEVDNDBFQzYwRUNEMEVEQy0wRURGMEYwMDBGNDAtMEY0NzBGNDktMEY2QzBGNzEtMEY4MTBGODgtMEY5NzBGOTktMEZCQzEwMDAtMTAzNjEwMzgxMDNCLTEwM0YxMDUwLTEwNjIxMDY1LTEwNjgxMDZFLTEwODYxMDhFMTA5QzEwOUQxMEEwLTEwQzUxMEM3MTBDRDEwRDAtMTBGQTEwRkMtMTI0ODEyNEEtMTI0RDEyNTAtMTI1NjEyNTgxMjVBLTEyNUQxMjYwLTEyODgxMjhBLTEyOEQxMjkwLTEyQjAxMkIyLTEyQjUxMkI4LTEyQkUxMkMwMTJDMi0xMkM1MTJDOC0xMkQ2MTJEOC0xMzEwMTMxMi0xMzE1MTMxOC0xMzVBMTM1RjEzODAtMTM4RjEzQTAtMTNGNDE0MDEtMTY2QzE2NkYtMTY3RjE2ODEtMTY5QTE2QTAtMTZFQTE2RUUtMTZGMDE3MDAtMTcwQzE3MEUtMTcxMzE3MjAtMTczMzE3NDAtMTc1MzE3NjAtMTc2QzE3NkUtMTc3MDE3NzIxNzczMTc4MC0xN0IzMTdCNi0xN0M4MTdENzE3REMxODIwLTE4NzcxODgwLTE4QUExOEIwLTE4RjUxOTAwLTE5MUMxOTIwLTE5MkIxOTMwLTE5MzgxOTUwLTE5NkQxOTcwLTE5NzQxOTgwLTE5QUIxOUIwLTE5QzkxQTAwLTFBMUIxQTIwLTFBNUUxQTYxLTFBNzQxQUE3MUIwMC0xQjMzMUIzNS0xQjQzMUI0NS0xQjRCMUI4MC0xQkE5MUJBQy0xQkFGMUJCQS0xQkU1MUJFNy0xQkYxMUMwMC0xQzM1MUM0RC0xQzRGMUM1QS0xQzdEMUNFOS0xQ0VDMUNFRS0xQ0YzMUNGNTFDRjYxRDAwLTFEQkYxRTAwLTFGMTUxRjE4LTFGMUQxRjIwLTFGNDUxRjQ4LTFGNEQxRjUwLTFGNTcxRjU5MUY1QjFGNUQxRjVGLTFGN0QxRjgwLTFGQjQxRkI2LTFGQkMxRkJFMUZDMi0xRkM0MUZDNi0xRkNDMUZEMC0xRkQzMUZENi0xRkRCMUZFMC0xRkVDMUZGMi0xRkY0MUZGNi0xRkZDMjA3MTIwN0YyMDkwLTIwOUMyMTAyMjEwNzIxMEEtMjExMzIxMTUyMTE5LTIxMUQyMTI0MjEyNjIxMjgyMTJBLTIxMkQyMTJGLTIxMzkyMTNDLTIxM0YyMTQ1LTIxNDkyMTRFMjE2MC0yMTg4MjRCNi0yNEU5MkMwMC0yQzJFMkMzMC0yQzVFMkM2MC0yQ0U0MkNFQi0yQ0VFMkNGMjJDRjMyRDAwLTJEMjUyRDI3MkQyRDJEMzAtMkQ2NzJENkYyRDgwLTJEOTYyREEwLTJEQTYyREE4LTJEQUUyREIwLTJEQjYyREI4LTJEQkUyREMwLTJEQzYyREM4LTJEQ0UyREQwLTJERDYyREQ4LTJEREUyREUwLTJERkYyRTJGMzAwNS0zMDA3MzAyMS0zMDI5MzAzMS0zMDM1MzAzOC0zMDNDMzA0MS0zMDk2MzA5RC0zMDlGMzBBMS0zMEZBMzBGQy0zMEZGMzEwNS0zMTJEMzEzMS0zMThFMzFBMC0zMUJBMzFGMC0zMUZGMzQwMC00REI1NEUwMC05RkNDQTAwMC1BNDhDQTREMC1BNEZEQTUwMC1BNjBDQTYxMC1BNjFGQTYyQUE2MkJBNjQwLUE2NkVBNjc0LUE2N0JBNjdGLUE2OTdBNjlGLUE2RUZBNzE3LUE3MUZBNzIyLUE3ODhBNzhCLUE3OEVBNzkwLUE3OTNBN0EwLUE3QUFBN0Y4LUE4MDFBODAzLUE4MDVBODA3LUE4MEFBODBDLUE4MjdBODQwLUE4NzNBODgwLUE4QzNBOEYyLUE4RjdBOEZCQTkwQS1BOTJBQTkzMC1BOTUyQTk2MC1BOTdDQTk4MC1BOUIyQTlCNC1BOUJGQTlDRkFBMDAtQUEzNkFBNDAtQUE0REFBNjAtQUE3NkFBN0FBQTgwLUFBQkVBQUMwQUFDMkFBREItQUFEREFBRTAtQUFFRkFBRjItQUFGNUFCMDEtQUIwNkFCMDktQUIwRUFCMTEtQUIxNkFCMjAtQUIyNkFCMjgtQUIyRUFCQzAtQUJFQUFDMDAtRDdBM0Q3QjAtRDdDNkQ3Q0ItRDdGQkY5MDAtRkE2REZBNzAtRkFEOUZCMDAtRkIwNkZCMTMtRkIxN0ZCMUQtRkIyOEZCMkEtRkIzNkZCMzgtRkIzQ0ZCM0VGQjQwRkI0MUZCNDNGQjQ0RkI0Ni1GQkIxRkJEMy1GRDNERkQ1MC1GRDhGRkQ5Mi1GREM3RkRGMC1GREZCRkU3MC1GRTc0RkU3Ni1GRUZDRkYyMS1GRjNBRkY0MS1GRjVBRkY2Ni1GRkJFRkZDMi1GRkM3RkZDQS1GRkNGRkZEMi1GRkQ3RkZEQS1GRkRDXCIsXHJcbiAgICAgICAgVXBwZXJjYXNlOiBcIjAwNDEtMDA1QTAwQzAtMDBENjAwRDgtMDBERTAxMDAwMTAyMDEwNDAxMDYwMTA4MDEwQTAxMEMwMTBFMDExMDAxMTIwMTE0MDExNjAxMTgwMTFBMDExQzAxMUUwMTIwMDEyMjAxMjQwMTI2MDEyODAxMkEwMTJDMDEyRTAxMzAwMTMyMDEzNDAxMzYwMTM5MDEzQjAxM0QwMTNGMDE0MTAxNDMwMTQ1MDE0NzAxNEEwMTRDMDE0RTAxNTAwMTUyMDE1NDAxNTYwMTU4MDE1QTAxNUMwMTVFMDE2MDAxNjIwMTY0MDE2NjAxNjgwMTZBMDE2QzAxNkUwMTcwMDE3MjAxNzQwMTc2MDE3ODAxNzkwMTdCMDE3RDAxODEwMTgyMDE4NDAxODYwMTg3MDE4OS0wMThCMDE4RS0wMTkxMDE5MzAxOTQwMTk2LTAxOTgwMTlDMDE5RDAxOUYwMUEwMDFBMjAxQTQwMUE2MDFBNzAxQTkwMUFDMDFBRTAxQUYwMUIxLTAxQjMwMUI1MDFCNzAxQjgwMUJDMDFDNDAxQzcwMUNBMDFDRDAxQ0YwMUQxMDFEMzAxRDUwMUQ3MDFEOTAxREIwMURFMDFFMDAxRTIwMUU0MDFFNjAxRTgwMUVBMDFFQzAxRUUwMUYxMDFGNDAxRjYtMDFGODAxRkEwMUZDMDFGRTAyMDAwMjAyMDIwNDAyMDYwMjA4MDIwQTAyMEMwMjBFMDIxMDAyMTIwMjE0MDIxNjAyMTgwMjFBMDIxQzAyMUUwMjIwMDIyMjAyMjQwMjI2MDIyODAyMkEwMjJDMDIyRTAyMzAwMjMyMDIzQTAyM0IwMjNEMDIzRTAyNDEwMjQzLTAyNDYwMjQ4MDI0QTAyNEMwMjRFMDM3MDAzNzIwMzc2MDM4NjAzODgtMDM4QTAzOEMwMzhFMDM4RjAzOTEtMDNBMTAzQTMtMDNBQjAzQ0YwM0QyLTAzRDQwM0Q4MDNEQTAzREMwM0RFMDNFMDAzRTIwM0U0MDNFNjAzRTgwM0VBMDNFQzAzRUUwM0Y0MDNGNzAzRjkwM0ZBMDNGRC0wNDJGMDQ2MDA0NjIwNDY0MDQ2NjA0NjgwNDZBMDQ2QzA0NkUwNDcwMDQ3MjA0NzQwNDc2MDQ3ODA0N0EwNDdDMDQ3RTA0ODAwNDhBMDQ4QzA0OEUwNDkwMDQ5MjA0OTQwNDk2MDQ5ODA0OUEwNDlDMDQ5RTA0QTAwNEEyMDRBNDA0QTYwNEE4MDRBQTA0QUMwNEFFMDRCMDA0QjIwNEI0MDRCNjA0QjgwNEJBMDRCQzA0QkUwNEMwMDRDMTA0QzMwNEM1MDRDNzA0QzkwNENCMDRDRDA0RDAwNEQyMDRENDA0RDYwNEQ4MDREQTA0REMwNERFMDRFMDA0RTIwNEU0MDRFNjA0RTgwNEVBMDRFQzA0RUUwNEYwMDRGMjA0RjQwNEY2MDRGODA0RkEwNEZDMDRGRTA1MDAwNTAyMDUwNDA1MDYwNTA4MDUwQTA1MEMwNTBFMDUxMDA1MTIwNTE0MDUxNjA1MTgwNTFBMDUxQzA1MUUwNTIwMDUyMjA1MjQwNTI2MDUzMS0wNTU2MTBBMC0xMEM1MTBDNzEwQ0QxRTAwMUUwMjFFMDQxRTA2MUUwODFFMEExRTBDMUUwRTFFMTAxRTEyMUUxNDFFMTYxRTE4MUUxQTFFMUMxRTFFMUUyMDFFMjIxRTI0MUUyNjFFMjgxRTJBMUUyQzFFMkUxRTMwMUUzMjFFMzQxRTM2MUUzODFFM0ExRTNDMUUzRTFFNDAxRTQyMUU0NDFFNDYxRTQ4MUU0QTFFNEMxRTRFMUU1MDFFNTIxRTU0MUU1NjFFNTgxRTVBMUU1QzFFNUUxRTYwMUU2MjFFNjQxRTY2MUU2ODFFNkExRTZDMUU2RTFFNzAxRTcyMUU3NDFFNzYxRTc4MUU3QTFFN0MxRTdFMUU4MDFFODIxRTg0MUU4NjFFODgxRThBMUU4QzFFOEUxRTkwMUU5MjFFOTQxRTlFMUVBMDFFQTIxRUE0MUVBNjFFQTgxRUFBMUVBQzFFQUUxRUIwMUVCMjFFQjQxRUI2MUVCODFFQkExRUJDMUVCRTFFQzAxRUMyMUVDNDFFQzYxRUM4MUVDQTFFQ0MxRUNFMUVEMDFFRDIxRUQ0MUVENjFFRDgxRURBMUVEQzFFREUxRUUwMUVFMjFFRTQxRUU2MUVFODFFRUExRUVDMUVFRTFFRjAxRUYyMUVGNDFFRjYxRUY4MUVGQTFFRkMxRUZFMUYwOC0xRjBGMUYxOC0xRjFEMUYyOC0xRjJGMUYzOC0xRjNGMUY0OC0xRjREMUY1OTFGNUIxRjVEMUY1RjFGNjgtMUY2RjFGQjgtMUZCQjFGQzgtMUZDQjFGRDgtMUZEQjFGRTgtMUZFQzFGRjgtMUZGQjIxMDIyMTA3MjEwQi0yMTBEMjExMC0yMTEyMjExNTIxMTktMjExRDIxMjQyMTI2MjEyODIxMkEtMjEyRDIxMzAtMjEzMzIxM0UyMTNGMjE0NTIxNjAtMjE2RjIxODMyNEI2LTI0Q0YyQzAwLTJDMkUyQzYwMkM2Mi0yQzY0MkM2NzJDNjkyQzZCMkM2RC0yQzcwMkM3MjJDNzUyQzdFLTJDODAyQzgyMkM4NDJDODYyQzg4MkM4QTJDOEMyQzhFMkM5MDJDOTIyQzk0MkM5NjJDOTgyQzlBMkM5QzJDOUUyQ0EwMkNBMjJDQTQyQ0E2MkNBODJDQUEyQ0FDMkNBRTJDQjAyQ0IyMkNCNDJDQjYyQ0I4MkNCQTJDQkMyQ0JFMkNDMDJDQzIyQ0M0MkNDNjJDQzgyQ0NBMkNDQzJDQ0UyQ0QwMkNEMjJDRDQyQ0Q2MkNEODJDREEyQ0RDMkNERTJDRTAyQ0UyMkNFQjJDRUQyQ0YyQTY0MEE2NDJBNjQ0QTY0NkE2NDhBNjRBQTY0Q0E2NEVBNjUwQTY1MkE2NTRBNjU2QTY1OEE2NUFBNjVDQTY1RUE2NjBBNjYyQTY2NEE2NjZBNjY4QTY2QUE2NkNBNjgwQTY4MkE2ODRBNjg2QTY4OEE2OEFBNjhDQTY4RUE2OTBBNjkyQTY5NEE2OTZBNzIyQTcyNEE3MjZBNzI4QTcyQUE3MkNBNzJFQTczMkE3MzRBNzM2QTczOEE3M0FBNzNDQTczRUE3NDBBNzQyQTc0NEE3NDZBNzQ4QTc0QUE3NENBNzRFQTc1MEE3NTJBNzU0QTc1NkE3NThBNzVBQTc1Q0E3NUVBNzYwQTc2MkE3NjRBNzY2QTc2OEE3NkFBNzZDQTc2RUE3NzlBNzdCQTc3REE3N0VBNzgwQTc4MkE3ODRBNzg2QTc4QkE3OERBNzkwQTc5MkE3QTBBN0EyQTdBNEE3QTZBN0E4QTdBQUZGMjEtRkYzQVwiLFxyXG4gICAgICAgIExvd2VyY2FzZTogXCIwMDYxLTAwN0EwMEFBMDBCNTAwQkEwMERGLTAwRjYwMEY4LTAwRkYwMTAxMDEwMzAxMDUwMTA3MDEwOTAxMEIwMTBEMDEwRjAxMTEwMTEzMDExNTAxMTcwMTE5MDExQjAxMUQwMTFGMDEyMTAxMjMwMTI1MDEyNzAxMjkwMTJCMDEyRDAxMkYwMTMxMDEzMzAxMzUwMTM3MDEzODAxM0EwMTNDMDEzRTAxNDAwMTQyMDE0NDAxNDYwMTQ4MDE0OTAxNEIwMTREMDE0RjAxNTEwMTUzMDE1NTAxNTcwMTU5MDE1QjAxNUQwMTVGMDE2MTAxNjMwMTY1MDE2NzAxNjkwMTZCMDE2RDAxNkYwMTcxMDE3MzAxNzUwMTc3MDE3QTAxN0MwMTdFLTAxODAwMTgzMDE4NTAxODgwMThDMDE4RDAxOTIwMTk1MDE5OS0wMTlCMDE5RTAxQTEwMUEzMDFBNTAxQTgwMUFBMDFBQjAxQUQwMUIwMDFCNDAxQjYwMUI5MDFCQTAxQkQtMDFCRjAxQzYwMUM5MDFDQzAxQ0UwMUQwMDFEMjAxRDQwMUQ2MDFEODAxREEwMURDMDFERDAxREYwMUUxMDFFMzAxRTUwMUU3MDFFOTAxRUIwMUVEMDFFRjAxRjAwMUYzMDFGNTAxRjkwMUZCMDFGRDAxRkYwMjAxMDIwMzAyMDUwMjA3MDIwOTAyMEIwMjBEMDIwRjAyMTEwMjEzMDIxNTAyMTcwMjE5MDIxQjAyMUQwMjFGMDIyMTAyMjMwMjI1MDIyNzAyMjkwMjJCMDIyRDAyMkYwMjMxMDIzMy0wMjM5MDIzQzAyM0YwMjQwMDI0MjAyNDcwMjQ5MDI0QjAyNEQwMjRGLTAyOTMwMjk1LTAyQjgwMkMwMDJDMTAyRTAtMDJFNDAzNDUwMzcxMDM3MzAzNzcwMzdBLTAzN0QwMzkwMDNBQy0wM0NFMDNEMDAzRDEwM0Q1LTAzRDcwM0Q5MDNEQjAzREQwM0RGMDNFMTAzRTMwM0U1MDNFNzAzRTkwM0VCMDNFRDAzRUYtMDNGMzAzRjUwM0Y4MDNGQjAzRkMwNDMwLTA0NUYwNDYxMDQ2MzA0NjUwNDY3MDQ2OTA0NkIwNDZEMDQ2RjA0NzEwNDczMDQ3NTA0NzcwNDc5MDQ3QjA0N0QwNDdGMDQ4MTA0OEIwNDhEMDQ4RjA0OTEwNDkzMDQ5NTA0OTcwNDk5MDQ5QjA0OUQwNDlGMDRBMTA0QTMwNEE1MDRBNzA0QTkwNEFCMDRBRDA0QUYwNEIxMDRCMzA0QjUwNEI3MDRCOTA0QkIwNEJEMDRCRjA0QzIwNEM0MDRDNjA0QzgwNENBMDRDQzA0Q0UwNENGMDREMTA0RDMwNEQ1MDRENzA0RDkwNERCMDRERDA0REYwNEUxMDRFMzA0RTUwNEU3MDRFOTA0RUIwNEVEMDRFRjA0RjEwNEYzMDRGNTA0RjcwNEY5MDRGQjA0RkQwNEZGMDUwMTA1MDMwNTA1MDUwNzA1MDkwNTBCMDUwRDA1MEYwNTExMDUxMzA1MTUwNTE3MDUxOTA1MUIwNTFEMDUxRjA1MjEwNTIzMDUyNTA1MjcwNTYxLTA1ODcxRDAwLTFEQkYxRTAxMUUwMzFFMDUxRTA3MUUwOTFFMEIxRTBEMUUwRjFFMTExRTEzMUUxNTFFMTcxRTE5MUUxQjFFMUQxRTFGMUUyMTFFMjMxRTI1MUUyNzFFMjkxRTJCMUUyRDFFMkYxRTMxMUUzMzFFMzUxRTM3MUUzOTFFM0IxRTNEMUUzRjFFNDExRTQzMUU0NTFFNDcxRTQ5MUU0QjFFNEQxRTRGMUU1MTFFNTMxRTU1MUU1NzFFNTkxRTVCMUU1RDFFNUYxRTYxMUU2MzFFNjUxRTY3MUU2OTFFNkIxRTZEMUU2RjFFNzExRTczMUU3NTFFNzcxRTc5MUU3QjFFN0QxRTdGMUU4MTFFODMxRTg1MUU4NzFFODkxRThCMUU4RDFFOEYxRTkxMUU5MzFFOTUtMUU5RDFFOUYxRUExMUVBMzFFQTUxRUE3MUVBOTFFQUIxRUFEMUVBRjFFQjExRUIzMUVCNTFFQjcxRUI5MUVCQjFFQkQxRUJGMUVDMTFFQzMxRUM1MUVDNzFFQzkxRUNCMUVDRDFFQ0YxRUQxMUVEMzFFRDUxRUQ3MUVEOTFFREIxRUREMUVERjFFRTExRUUzMUVFNTFFRTcxRUU5MUVFQjFFRUQxRUVGMUVGMTFFRjMxRUY1MUVGNzFFRjkxRUZCMUVGRDFFRkYtMUYwNzFGMTAtMUYxNTFGMjAtMUYyNzFGMzAtMUYzNzFGNDAtMUY0NTFGNTAtMUY1NzFGNjAtMUY2NzFGNzAtMUY3RDFGODAtMUY4NzFGOTAtMUY5NzFGQTAtMUZBNzFGQjAtMUZCNDFGQjYxRkI3MUZCRTFGQzItMUZDNDFGQzYxRkM3MUZEMC0xRkQzMUZENjFGRDcxRkUwLTFGRTcxRkYyLTFGRjQxRkY2MUZGNzIwNzEyMDdGMjA5MC0yMDlDMjEwQTIxMEUyMTBGMjExMzIxMkYyMTM0MjEzOTIxM0MyMTNEMjE0Ni0yMTQ5MjE0RTIxNzAtMjE3RjIxODQyNEQwLTI0RTkyQzMwLTJDNUUyQzYxMkM2NTJDNjYyQzY4MkM2QTJDNkMyQzcxMkM3MzJDNzQyQzc2LTJDN0QyQzgxMkM4MzJDODUyQzg3MkM4OTJDOEIyQzhEMkM4RjJDOTEyQzkzMkM5NTJDOTcyQzk5MkM5QjJDOUQyQzlGMkNBMTJDQTMyQ0E1MkNBNzJDQTkyQ0FCMkNBRDJDQUYyQ0IxMkNCMzJDQjUyQ0I3MkNCOTJDQkIyQ0JEMkNCRjJDQzEyQ0MzMkNDNTJDQzcyQ0M5MkNDQjJDQ0QyQ0NGMkNEMTJDRDMyQ0Q1MkNENzJDRDkyQ0RCMkNERDJDREYyQ0UxMkNFMzJDRTQyQ0VDMkNFRTJDRjMyRDAwLTJEMjUyRDI3MkQyREE2NDFBNjQzQTY0NUE2NDdBNjQ5QTY0QkE2NERBNjRGQTY1MUE2NTNBNjU1QTY1N0E2NTlBNjVCQTY1REE2NUZBNjYxQTY2M0E2NjVBNjY3QTY2OUE2NkJBNjZEQTY4MUE2ODNBNjg1QTY4N0E2ODlBNjhCQTY4REE2OEZBNjkxQTY5M0E2OTVBNjk3QTcyM0E3MjVBNzI3QTcyOUE3MkJBNzJEQTcyRi1BNzMxQTczM0E3MzVBNzM3QTczOUE3M0JBNzNEQTczRkE3NDFBNzQzQTc0NUE3NDdBNzQ5QTc0QkE3NERBNzRGQTc1MUE3NTNBNzU1QTc1N0E3NTlBNzVCQTc1REE3NUZBNzYxQTc2M0E3NjVBNzY3QTc2OUE3NkJBNzZEQTc2Ri1BNzc4QTc3QUE3N0NBNzdGQTc4MUE3ODNBNzg1QTc4N0E3OENBNzhFQTc5MUE3OTNBN0ExQTdBM0E3QTVBN0E3QTdBOUE3RjgtQTdGQUZCMDAtRkIwNkZCMTMtRkIxN0ZGNDEtRkY1QVwiLFxyXG4gICAgICAgIFdoaXRlX1NwYWNlOiBcIjAwMDktMDAwRDAwMjAwMDg1MDBBMDE2ODAxODBFMjAwMC0yMDBBMjAyODIwMjkyMDJGMjA1RjMwMDBcIixcclxuICAgICAgICBOb25jaGFyYWN0ZXJfQ29kZV9Qb2ludDogXCJGREQwLUZERUZGRkZFRkZGRlwiLFxyXG4gICAgICAgIERlZmF1bHRfSWdub3JhYmxlX0NvZGVfUG9pbnQ6IFwiMDBBRDAzNEYxMTVGMTE2MDE3QjQxN0I1MTgwQi0xODBEMjAwQi0yMDBGMjAyQS0yMDJFMjA2MC0yMDZGMzE2NEZFMDAtRkUwRkZFRkZGRkEwRkZGMC1GRkY4XCIsXHJcbiAgICAgICAgLy8gXFxwe0FueX0gbWF0Y2hlcyBhIGNvZGUgdW5pdC4gVG8gbWF0Y2ggYW55IGNvZGUgcG9pbnQgdmlhIHN1cnJvZ2F0ZSBwYWlycywgdXNlICg/OltcXDAtXFx1RDdGRlxcdURDMDAtXFx1RkZGRl18W1xcdUQ4MDAtXFx1REJGRl1bXFx1REMwMC1cXHVERkZGXXxbXFx1RDgwMC1cXHVEQkZGXSlcclxuICAgICAgICBBbnk6IFwiMDAwMC1GRkZGXCIsIC8vIFxccHteQW55fSBjb21waWxlcyB0byBbXlxcdTAwMDAtXFx1RkZGRl07IFtcXHB7XkFueX1dIHRvIFtdXHJcbiAgICAgICAgQXNjaWk6IFwiMDAwMC0wMDdGXCIsXHJcbiAgICAgICAgLy8gXFxwe0Fzc2lnbmVkfSBpcyBlcXVpdmFsZW50IHRvIFxccHteQ259XHJcbiAgICAgICAgLy9Bc3NpZ25lZDogWFJlZ0V4cChcIltcXFxccHteQ259XVwiKS5zb3VyY2UucmVwbGFjZSgvW1tcXF1dfFxcXFx1L2csIFwiXCIpIC8vIE5lZ2F0aW9uIGluc2lkZSBhIGNoYXJhY3RlciBjbGFzcyB0cmlnZ2VycyBpbnZlcnNpb25cclxuICAgICAgICBBc3NpZ25lZDogXCIwMDAwLTAzNzcwMzdBLTAzN0UwMzg0LTAzOEEwMzhDMDM4RS0wM0ExMDNBMy0wNTI3MDUzMS0wNTU2MDU1OS0wNTVGMDU2MS0wNTg3MDU4OTA1OEEwNThGMDU5MS0wNUM3MDVEMC0wNUVBMDVGMC0wNUY0MDYwMC0wNjA0MDYwNi0wNjFCMDYxRS0wNzBEMDcwRi0wNzRBMDc0RC0wN0IxMDdDMC0wN0ZBMDgwMC0wODJEMDgzMC0wODNFMDg0MC0wODVCMDg1RTA4QTAwOEEyLTA4QUMwOEU0LTA4RkUwOTAwLTA5NzcwOTc5LTA5N0YwOTgxLTA5ODMwOTg1LTA5OEMwOThGMDk5MDA5OTMtMDlBODA5QUEtMDlCMDA5QjIwOUI2LTA5QjkwOUJDLTA5QzQwOUM3MDlDODA5Q0ItMDlDRTA5RDcwOURDMDlERDA5REYtMDlFMzA5RTYtMDlGQjBBMDEtMEEwMzBBMDUtMEEwQTBBMEYwQTEwMEExMy0wQTI4MEEyQS0wQTMwMEEzMjBBMzMwQTM1MEEzNjBBMzgwQTM5MEEzQzBBM0UtMEE0MjBBNDcwQTQ4MEE0Qi0wQTREMEE1MTBBNTktMEE1QzBBNUUwQTY2LTBBNzUwQTgxLTBBODMwQTg1LTBBOEQwQThGLTBBOTEwQTkzLTBBQTgwQUFBLTBBQjAwQUIyMEFCMzBBQjUtMEFCOTBBQkMtMEFDNTBBQzctMEFDOTBBQ0ItMEFDRDBBRDAwQUUwLTBBRTMwQUU2LTBBRjEwQjAxLTBCMDMwQjA1LTBCMEMwQjBGMEIxMDBCMTMtMEIyODBCMkEtMEIzMDBCMzIwQjMzMEIzNS0wQjM5MEIzQy0wQjQ0MEI0NzBCNDgwQjRCLTBCNEQwQjU2MEI1NzBCNUMwQjVEMEI1Ri0wQjYzMEI2Ni0wQjc3MEI4MjBCODMwQjg1LTBCOEEwQjhFLTBCOTAwQjkyLTBCOTUwQjk5MEI5QTBCOUMwQjlFMEI5RjBCQTMwQkE0MEJBOC0wQkFBMEJBRS0wQkI5MEJCRS0wQkMyMEJDNi0wQkM4MEJDQS0wQkNEMEJEMDBCRDcwQkU2LTBCRkEwQzAxLTBDMDMwQzA1LTBDMEMwQzBFLTBDMTAwQzEyLTBDMjgwQzJBLTBDMzMwQzM1LTBDMzkwQzNELTBDNDQwQzQ2LTBDNDgwQzRBLTBDNEQwQzU1MEM1NjBDNTgwQzU5MEM2MC0wQzYzMEM2Ni0wQzZGMEM3OC0wQzdGMEM4MjBDODMwQzg1LTBDOEMwQzhFLTBDOTAwQzkyLTBDQTgwQ0FBLTBDQjMwQ0I1LTBDQjkwQ0JDLTBDQzQwQ0M2LTBDQzgwQ0NBLTBDQ0QwQ0Q1MENENjBDREUwQ0UwLTBDRTMwQ0U2LTBDRUYwQ0YxMENGMjBEMDIwRDAzMEQwNS0wRDBDMEQwRS0wRDEwMEQxMi0wRDNBMEQzRC0wRDQ0MEQ0Ni0wRDQ4MEQ0QS0wRDRFMEQ1NzBENjAtMEQ2MzBENjYtMEQ3NTBENzktMEQ3RjBEODIwRDgzMEQ4NS0wRDk2MEQ5QS0wREIxMERCMy0wREJCMERCRDBEQzAtMERDNjBEQ0EwRENGLTBERDQwREQ2MEREOC0wRERGMERGMi0wREY0MEUwMS0wRTNBMEUzRi0wRTVCMEU4MTBFODIwRTg0MEU4NzBFODgwRThBMEU4RDBFOTQtMEU5NzBFOTktMEU5RjBFQTEtMEVBMzBFQTUwRUE3MEVBQTBFQUIwRUFELTBFQjkwRUJCLTBFQkQwRUMwLTBFQzQwRUM2MEVDOC0wRUNEMEVEMC0wRUQ5MEVEQy0wRURGMEYwMC0wRjQ3MEY0OS0wRjZDMEY3MS0wRjk3MEY5OS0wRkJDMEZCRS0wRkNDMEZDRS0wRkRBMTAwMC0xMEM1MTBDNzEwQ0QxMEQwLTEyNDgxMjRBLTEyNEQxMjUwLTEyNTYxMjU4MTI1QS0xMjVEMTI2MC0xMjg4MTI4QS0xMjhEMTI5MC0xMkIwMTJCMi0xMkI1MTJCOC0xMkJFMTJDMDEyQzItMTJDNTEyQzgtMTJENjEyRDgtMTMxMDEzMTItMTMxNTEzMTgtMTM1QTEzNUQtMTM3QzEzODAtMTM5OTEzQTAtMTNGNDE0MDAtMTY5QzE2QTAtMTZGMDE3MDAtMTcwQzE3MEUtMTcxNDE3MjAtMTczNjE3NDAtMTc1MzE3NjAtMTc2QzE3NkUtMTc3MDE3NzIxNzczMTc4MC0xN0REMTdFMC0xN0U5MTdGMC0xN0Y5MTgwMC0xODBFMTgxMC0xODE5MTgyMC0xODc3MTg4MC0xOEFBMThCMC0xOEY1MTkwMC0xOTFDMTkyMC0xOTJCMTkzMC0xOTNCMTk0MDE5NDQtMTk2RDE5NzAtMTk3NDE5ODAtMTlBQjE5QjAtMTlDOTE5RDAtMTlEQTE5REUtMUExQjFBMUUtMUE1RTFBNjAtMUE3QzFBN0YtMUE4OTFBOTAtMUE5OTFBQTAtMUFBRDFCMDAtMUI0QjFCNTAtMUI3QzFCODAtMUJGMzFCRkMtMUMzNzFDM0ItMUM0OTFDNEQtMUM3RjFDQzAtMUNDNzFDRDAtMUNGNjFEMDAtMURFNjFERkMtMUYxNTFGMTgtMUYxRDFGMjAtMUY0NTFGNDgtMUY0RDFGNTAtMUY1NzFGNTkxRjVCMUY1RDFGNUYtMUY3RDFGODAtMUZCNDFGQjYtMUZDNDFGQzYtMUZEMzFGRDYtMUZEQjFGREQtMUZFRjFGRjItMUZGNDFGRjYtMUZGRTIwMDAtMjA2NDIwNkEtMjA3MTIwNzQtMjA4RTIwOTAtMjA5QzIwQTAtMjBCOTIwRDAtMjBGMDIxMDAtMjE4OTIxOTAtMjNGMzI0MDAtMjQyNjI0NDAtMjQ0QTI0NjAtMjZGRjI3MDEtMkI0QzJCNTAtMkI1OTJDMDAtMkMyRTJDMzAtMkM1RTJDNjAtMkNGMzJDRjktMkQyNTJEMjcyRDJEMkQzMC0yRDY3MkQ2RjJENzAyRDdGLTJEOTYyREEwLTJEQTYyREE4LTJEQUUyREIwLTJEQjYyREI4LTJEQkUyREMwLTJEQzYyREM4LTJEQ0UyREQwLTJERDYyREQ4LTJEREUyREUwLTJFM0IyRTgwLTJFOTkyRTlCLTJFRjMyRjAwLTJGRDUyRkYwLTJGRkIzMDAwLTMwM0YzMDQxLTMwOTYzMDk5LTMwRkYzMTA1LTMxMkQzMTMxLTMxOEUzMTkwLTMxQkEzMUMwLTMxRTMzMUYwLTMyMUUzMjIwLTMyRkUzMzAwLTREQjU0REMwLTlGQ0NBMDAwLUE0OENBNDkwLUE0QzZBNEQwLUE2MkJBNjQwLUE2OTdBNjlGLUE2RjdBNzAwLUE3OEVBNzkwLUE3OTNBN0EwLUE3QUFBN0Y4LUE4MkJBODMwLUE4MzlBODQwLUE4NzdBODgwLUE4QzRBOENFLUE4RDlBOEUwLUE4RkJBOTAwLUE5NTNBOTVGLUE5N0NBOTgwLUE5Q0RBOUNGLUE5RDlBOURFQTlERkFBMDAtQUEzNkFBNDAtQUE0REFBNTAtQUE1OUFBNUMtQUE3QkFBODAtQUFDMkFBREItQUFGNkFCMDEtQUIwNkFCMDktQUIwRUFCMTEtQUIxNkFCMjAtQUIyNkFCMjgtQUIyRUFCQzAtQUJFREFCRjAtQUJGOUFDMDAtRDdBM0Q3QjAtRDdDNkQ3Q0ItRDdGQkQ4MDAtRkE2REZBNzAtRkFEOUZCMDAtRkIwNkZCMTMtRkIxN0ZCMUQtRkIzNkZCMzgtRkIzQ0ZCM0VGQjQwRkI0MUZCNDNGQjQ0RkI0Ni1GQkMxRkJEMy1GRDNGRkQ1MC1GRDhGRkQ5Mi1GREM3RkRGMC1GREZERkUwMC1GRTE5RkUyMC1GRTI2RkUzMC1GRTUyRkU1NC1GRTY2RkU2OC1GRTZCRkU3MC1GRTc0RkU3Ni1GRUZDRkVGRkZGMDEtRkZCRUZGQzItRkZDN0ZGQ0EtRkZDRkZGRDItRkZEN0ZGREEtRkZEQ0ZGRTAtRkZFNkZGRTgtRkZFRUZGRjktRkZGRFwiXHJcbiAgICB9KTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuXG4vKioqKiogbWF0Y2hyZWN1cnNpdmUuanMgKioqKiovXG5cbi8qIVxyXG4gKiBYUmVnRXhwLm1hdGNoUmVjdXJzaXZlIHYwLjIuMFxyXG4gKiAoYykgMjAwOS0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICovXHJcblxyXG4oZnVuY3Rpb24gKFhSZWdFeHApIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBtYXRjaCBkZXRhaWwgb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwcm92aWRlZCB2YWx1ZXMuXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gcm93KHZhbHVlLCBuYW1lLCBzdGFydCwgZW5kKSB7XHJcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp2YWx1ZSwgbmFtZTpuYW1lLCBzdGFydDpzdGFydCwgZW5kOmVuZH07XHJcbiAgICB9XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhbiBhcnJheSBvZiBtYXRjaCBzdHJpbmdzIGJldHdlZW4gb3V0ZXJtb3N0IGxlZnQgYW5kIHJpZ2h0IGRlbGltaXRlcnMsIG9yIGFuIGFycmF5IG9mXHJcbiAqIG9iamVjdHMgd2l0aCBkZXRhaWxlZCBtYXRjaCBwYXJ0cyBhbmQgcG9zaXRpb24gZGF0YS4gQW4gZXJyb3IgaXMgdGhyb3duIGlmIGRlbGltaXRlcnMgYXJlXHJcbiAqIHVuYmFsYW5jZWQgd2l0aGluIHRoZSBkYXRhLlxyXG4gKiBAbWVtYmVyT2YgWFJlZ0V4cFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzZWFyY2guXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBsZWZ0IExlZnQgZGVsaW1pdGVyIGFzIGFuIFhSZWdFeHAgcGF0dGVybi5cclxuICogQHBhcmFtIHtTdHJpbmd9IHJpZ2h0IFJpZ2h0IGRlbGltaXRlciBhcyBhbiBYUmVnRXhwIHBhdHRlcm4uXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZmxhZ3NdIEZsYWdzIGZvciB0aGUgbGVmdCBhbmQgcmlnaHQgZGVsaW1pdGVycy4gVXNlIGFueSBvZjogYGdpbW5zeHlgLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIExldHMgeW91IHNwZWNpZnkgYHZhbHVlTmFtZXNgIGFuZCBgZXNjYXBlQ2hhcmAgb3B0aW9ucy5cclxuICogQHJldHVybnMge0FycmF5fSBBcnJheSBvZiBtYXRjaGVzLCBvciBhbiBlbXB0eSBhcnJheS5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogLy8gQmFzaWMgdXNhZ2VcclxuICogdmFyIHN0ciA9ICcodCgoZSkpcyl0KCkoaW5nKSc7XHJcbiAqIFhSZWdFeHAubWF0Y2hSZWN1cnNpdmUoc3RyLCAnXFxcXCgnLCAnXFxcXCknLCAnZycpO1xyXG4gKiAvLyAtPiBbJ3QoKGUpKXMnLCAnJywgJ2luZyddXHJcbiAqXHJcbiAqIC8vIEV4dGVuZGVkIGluZm9ybWF0aW9uIG1vZGUgd2l0aCB2YWx1ZU5hbWVzXHJcbiAqIHN0ciA9ICdIZXJlIGlzIDxkaXY+IDxkaXY+YW48L2Rpdj48L2Rpdj4gZXhhbXBsZSc7XHJcbiAqIFhSZWdFeHAubWF0Y2hSZWN1cnNpdmUoc3RyLCAnPGRpdlxcXFxzKj4nLCAnPC9kaXY+JywgJ2dpJywge1xyXG4gKiAgIHZhbHVlTmFtZXM6IFsnYmV0d2VlbicsICdsZWZ0JywgJ21hdGNoJywgJ3JpZ2h0J11cclxuICogfSk7XHJcbiAqIC8vIC0+IFtcclxuICogLy8ge25hbWU6ICdiZXR3ZWVuJywgdmFsdWU6ICdIZXJlIGlzICcsICAgICAgIHN0YXJ0OiAwLCAgZW5kOiA4fSxcclxuICogLy8ge25hbWU6ICdsZWZ0JywgICAgdmFsdWU6ICc8ZGl2PicsICAgICAgICAgIHN0YXJ0OiA4LCAgZW5kOiAxM30sXHJcbiAqIC8vIHtuYW1lOiAnbWF0Y2gnLCAgIHZhbHVlOiAnIDxkaXY+YW48L2Rpdj4nLCBzdGFydDogMTMsIGVuZDogMjd9LFxyXG4gKiAvLyB7bmFtZTogJ3JpZ2h0JywgICB2YWx1ZTogJzwvZGl2PicsICAgICAgICAgc3RhcnQ6IDI3LCBlbmQ6IDMzfSxcclxuICogLy8ge25hbWU6ICdiZXR3ZWVuJywgdmFsdWU6ICcgZXhhbXBsZScsICAgICAgIHN0YXJ0OiAzMywgZW5kOiA0MX1cclxuICogLy8gXVxyXG4gKlxyXG4gKiAvLyBPbWl0dGluZyB1bm5lZWRlZCBwYXJ0cyB3aXRoIG51bGwgdmFsdWVOYW1lcywgYW5kIHVzaW5nIGVzY2FwZUNoYXJcclxuICogc3RyID0gJy4uLnsxfVxcXFx7e2Z1bmN0aW9uKHgseSl7cmV0dXJuIHkreDt9fSc7XHJcbiAqIFhSZWdFeHAubWF0Y2hSZWN1cnNpdmUoc3RyLCAneycsICd9JywgJ2cnLCB7XHJcbiAqICAgdmFsdWVOYW1lczogWydsaXRlcmFsJywgbnVsbCwgJ3ZhbHVlJywgbnVsbF0sXHJcbiAqICAgZXNjYXBlQ2hhcjogJ1xcXFwnXHJcbiAqIH0pO1xyXG4gKiAvLyAtPiBbXHJcbiAqIC8vIHtuYW1lOiAnbGl0ZXJhbCcsIHZhbHVlOiAnLi4uJywgc3RhcnQ6IDAsIGVuZDogM30sXHJcbiAqIC8vIHtuYW1lOiAndmFsdWUnLCAgIHZhbHVlOiAnMScsICAgc3RhcnQ6IDQsIGVuZDogNX0sXHJcbiAqIC8vIHtuYW1lOiAnbGl0ZXJhbCcsIHZhbHVlOiAnXFxcXHsnLCBzdGFydDogNiwgZW5kOiA4fSxcclxuICogLy8ge25hbWU6ICd2YWx1ZScsICAgdmFsdWU6ICdmdW5jdGlvbih4LHkpe3JldHVybiB5K3g7fScsIHN0YXJ0OiA5LCBlbmQ6IDM1fVxyXG4gKiAvLyBdXHJcbiAqXHJcbiAqIC8vIFN0aWNreSBtb2RlIHZpYSBmbGFnIHlcclxuICogc3RyID0gJzwxPjw8PDI+Pj48Mz40PDU+JztcclxuICogWFJlZ0V4cC5tYXRjaFJlY3Vyc2l2ZShzdHIsICc8JywgJz4nLCAnZ3knKTtcclxuICogLy8gLT4gWycxJywgJzw8Mj4+JywgJzMnXVxyXG4gKi9cclxuICAgIFhSZWdFeHAubWF0Y2hSZWN1cnNpdmUgPSBmdW5jdGlvbiAoc3RyLCBsZWZ0LCByaWdodCwgZmxhZ3MsIG9wdGlvbnMpIHtcclxuICAgICAgICBmbGFncyA9IGZsYWdzIHx8IFwiXCI7XHJcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICAgICAgdmFyIGdsb2JhbCA9IGZsYWdzLmluZGV4T2YoXCJnXCIpID4gLTEsXHJcbiAgICAgICAgICAgIHN0aWNreSA9IGZsYWdzLmluZGV4T2YoXCJ5XCIpID4gLTEsXHJcbiAgICAgICAgICAgIGJhc2ljRmxhZ3MgPSBmbGFncy5yZXBsYWNlKC95L2csIFwiXCIpLCAvLyBGbGFnIHkgY29udHJvbGxlZCBpbnRlcm5hbGx5XHJcbiAgICAgICAgICAgIGVzY2FwZUNoYXIgPSBvcHRpb25zLmVzY2FwZUNoYXIsXHJcbiAgICAgICAgICAgIHZOID0gb3B0aW9ucy52YWx1ZU5hbWVzLFxyXG4gICAgICAgICAgICBvdXRwdXQgPSBbXSxcclxuICAgICAgICAgICAgb3BlblRva2VucyA9IDAsXHJcbiAgICAgICAgICAgIGRlbGltU3RhcnQgPSAwLFxyXG4gICAgICAgICAgICBkZWxpbUVuZCA9IDAsXHJcbiAgICAgICAgICAgIGxhc3RPdXRlckVuZCA9IDAsXHJcbiAgICAgICAgICAgIG91dGVyU3RhcnQsXHJcbiAgICAgICAgICAgIGlubmVyU3RhcnQsXHJcbiAgICAgICAgICAgIGxlZnRNYXRjaCxcclxuICAgICAgICAgICAgcmlnaHRNYXRjaCxcclxuICAgICAgICAgICAgZXNjO1xyXG4gICAgICAgIGxlZnQgPSBYUmVnRXhwKGxlZnQsIGJhc2ljRmxhZ3MpO1xyXG4gICAgICAgIHJpZ2h0ID0gWFJlZ0V4cChyaWdodCwgYmFzaWNGbGFncyk7XHJcblxyXG4gICAgICAgIGlmIChlc2NhcGVDaGFyKSB7XHJcbiAgICAgICAgICAgIGlmIChlc2NhcGVDaGFyLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcImNhbid0IHVzZSBtb3JlIHRoYW4gb25lIGVzY2FwZSBjaGFyYWN0ZXJcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZXNjYXBlQ2hhciA9IFhSZWdFeHAuZXNjYXBlKGVzY2FwZUNoYXIpO1xyXG4gICAgICAgICAgICAvLyBVc2luZyBYUmVnRXhwLnVuaW9uIHNhZmVseSByZXdyaXRlcyBiYWNrcmVmZXJlbmNlcyBpbiBgbGVmdGAgYW5kIGByaWdodGBcclxuICAgICAgICAgICAgZXNjID0gbmV3IFJlZ0V4cChcclxuICAgICAgICAgICAgICAgIFwiKD86XCIgKyBlc2NhcGVDaGFyICsgXCJbXFxcXFNcXFxcc118KD86KD8hXCIgKyBYUmVnRXhwLnVuaW9uKFtsZWZ0LCByaWdodF0pLnNvdXJjZSArIFwiKVteXCIgKyBlc2NhcGVDaGFyICsgXCJdKSspK1wiLFxyXG4gICAgICAgICAgICAgICAgZmxhZ3MucmVwbGFjZSgvW15pbV0rL2csIFwiXCIpIC8vIEZsYWdzIGd5IG5vdCBuZWVkZWQgaGVyZTsgZmxhZ3MgbnN4IGhhbmRsZWQgYnkgWFJlZ0V4cFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICAgICAgLy8gSWYgdXNpbmcgYW4gZXNjYXBlIGNoYXJhY3RlciwgYWR2YW5jZSB0byB0aGUgZGVsaW1pdGVyJ3MgbmV4dCBzdGFydGluZyBwb3NpdGlvbixcclxuICAgICAgICAgICAgLy8gc2tpcHBpbmcgYW55IGVzY2FwZWQgY2hhcmFjdGVycyBpbiBiZXR3ZWVuXHJcbiAgICAgICAgICAgIGlmIChlc2NhcGVDaGFyKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxpbUVuZCArPSAoWFJlZ0V4cC5leGVjKHN0ciwgZXNjLCBkZWxpbUVuZCwgXCJzdGlja3lcIikgfHwgW1wiXCJdKVswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGVmdE1hdGNoID0gWFJlZ0V4cC5leGVjKHN0ciwgbGVmdCwgZGVsaW1FbmQpO1xyXG4gICAgICAgICAgICByaWdodE1hdGNoID0gWFJlZ0V4cC5leGVjKHN0ciwgcmlnaHQsIGRlbGltRW5kKTtcclxuICAgICAgICAgICAgLy8gS2VlcCB0aGUgbGVmdG1vc3QgbWF0Y2ggb25seVxyXG4gICAgICAgICAgICBpZiAobGVmdE1hdGNoICYmIHJpZ2h0TWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgIGlmIChsZWZ0TWF0Y2guaW5kZXggPD0gcmlnaHRNYXRjaC5pbmRleCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0TWF0Y2ggPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBsZWZ0TWF0Y2ggPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8qIFBhdGhzIChMTTpsZWZ0TWF0Y2gsIFJNOnJpZ2h0TWF0Y2gsIE9UOm9wZW5Ub2tlbnMpOlxyXG4gICAgICAgICAgICBMTSB8IFJNIHwgT1QgfCBSZXN1bHRcclxuICAgICAgICAgICAgMSAgfCAwICB8IDEgIHwgbG9vcFxyXG4gICAgICAgICAgICAxICB8IDAgIHwgMCAgfCBsb29wXHJcbiAgICAgICAgICAgIDAgIHwgMSAgfCAxICB8IGxvb3BcclxuICAgICAgICAgICAgMCAgfCAxICB8IDAgIHwgdGhyb3dcclxuICAgICAgICAgICAgMCAgfCAwICB8IDEgIHwgdGhyb3dcclxuICAgICAgICAgICAgMCAgfCAwICB8IDAgIHwgYnJlYWtcclxuICAgICAgICAgICAgKiBEb2Vzbid0IGluY2x1ZGUgdGhlIHN0aWNreSBtb2RlIHNwZWNpYWwgY2FzZVxyXG4gICAgICAgICAgICAqIExvb3AgZW5kcyBhZnRlciB0aGUgZmlyc3QgY29tcGxldGVkIG1hdGNoIGlmIGAhZ2xvYmFsYCAqL1xyXG4gICAgICAgICAgICBpZiAobGVmdE1hdGNoIHx8IHJpZ2h0TWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgIGRlbGltU3RhcnQgPSAobGVmdE1hdGNoIHx8IHJpZ2h0TWF0Y2gpLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgZGVsaW1FbmQgPSBkZWxpbVN0YXJ0ICsgKGxlZnRNYXRjaCB8fCByaWdodE1hdGNoKVswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIW9wZW5Ub2tlbnMpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChzdGlja3kgJiYgIW9wZW5Ub2tlbnMgJiYgZGVsaW1TdGFydCA+IGxhc3RPdXRlckVuZCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGxlZnRNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFvcGVuVG9rZW5zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0ZXJTdGFydCA9IGRlbGltU3RhcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5uZXJTdGFydCA9IGRlbGltRW5kO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgKytvcGVuVG9rZW5zO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJpZ2h0TWF0Y2ggJiYgb3BlblRva2Vucykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCEtLW9wZW5Ub2tlbnMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodk4pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZOWzBdICYmIG91dGVyU3RhcnQgPiBsYXN0T3V0ZXJFbmQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKHJvdyh2TlswXSwgc3RyLnNsaWNlKGxhc3RPdXRlckVuZCwgb3V0ZXJTdGFydCksIGxhc3RPdXRlckVuZCwgb3V0ZXJTdGFydCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2TlsxXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gocm93KHZOWzFdLCBzdHIuc2xpY2Uob3V0ZXJTdGFydCwgaW5uZXJTdGFydCksIG91dGVyU3RhcnQsIGlubmVyU3RhcnQpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodk5bMl0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKHJvdyh2TlsyXSwgc3RyLnNsaWNlKGlubmVyU3RhcnQsIGRlbGltU3RhcnQpLCBpbm5lclN0YXJ0LCBkZWxpbVN0YXJ0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZOWzNdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChyb3codk5bM10sIHN0ci5zbGljZShkZWxpbVN0YXJ0LCBkZWxpbUVuZCksIGRlbGltU3RhcnQsIGRlbGltRW5kKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChzdHIuc2xpY2UoaW5uZXJTdGFydCwgZGVsaW1TdGFydCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBsYXN0T3V0ZXJFbmQgPSBkZWxpbUVuZDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWdsb2JhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdHJpbmcgY29udGFpbnMgdW5iYWxhbmNlZCBkZWxpbWl0ZXJzXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIElmIHRoZSBkZWxpbWl0ZXIgbWF0Y2hlZCBhbiBlbXB0eSBzdHJpbmcsIGF2b2lkIGFuIGluZmluaXRlIGxvb3BcclxuICAgICAgICAgICAgaWYgKGRlbGltU3RhcnQgPT09IGRlbGltRW5kKSB7XHJcbiAgICAgICAgICAgICAgICArK2RlbGltRW5kO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZ2xvYmFsICYmICFzdGlja3kgJiYgdk4gJiYgdk5bMF0gJiYgc3RyLmxlbmd0aCA+IGxhc3RPdXRlckVuZCkge1xyXG4gICAgICAgICAgICBvdXRwdXQucHVzaChyb3codk5bMF0sIHN0ci5zbGljZShsYXN0T3V0ZXJFbmQpLCBsYXN0T3V0ZXJFbmQsIHN0ci5sZW5ndGgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBvdXRwdXQ7XHJcbiAgICB9O1xyXG5cclxufShYUmVnRXhwKSk7XHJcblxyXG5cbi8qKioqKiBidWlsZC5qcyAqKioqKi9cblxuLyohXHJcbiAqIFhSZWdFeHAuYnVpbGQgdjAuMS4wXHJcbiAqIChjKSAyMDEyIFN0ZXZlbiBMZXZpdGhhbiA8aHR0cDovL3hyZWdleHAuY29tLz5cclxuICogTUlUIExpY2Vuc2VcclxuICogSW5zcGlyZWQgYnkgUmVnRXhwLmNyZWF0ZSBieSBMZWEgVmVyb3UgPGh0dHA6Ly9sZWEudmVyb3UubWUvPlxyXG4gKi9cclxuXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgdmFyIHN1YnBhcnRzID0gLyhcXCgpKD8hXFw/KXxcXFxcKFsxLTldXFxkKil8XFxcXFtcXHNcXFNdfFxcWyg/OlteXFxcXFxcXV18XFxcXFtcXHNcXFNdKSpdL2csXHJcbiAgICAgICAgcGFydHMgPSBYUmVnRXhwLnVuaW9uKFsvXFwoe3soW1xcdyRdKyl9fVxcKXx7eyhbXFx3JF0rKX19Lywgc3VicGFydHNdLCBcImdcIik7XHJcblxyXG4vKipcclxuICogU3RyaXBzIGEgbGVhZGluZyBgXmAgYW5kIHRyYWlsaW5nIHVuZXNjYXBlZCBgJGAsIGlmIGJvdGggYXJlIHByZXNlbnQuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXR0ZXJuIFBhdHRlcm4gdG8gcHJvY2Vzcy5cclxuICogQHJldHVybnMge1N0cmluZ30gUGF0dGVybiB3aXRoIGVkZ2UgYW5jaG9ycyByZW1vdmVkLlxyXG4gKi9cclxuICAgIGZ1bmN0aW9uIGRlYW5jaG9yKHBhdHRlcm4pIHtcclxuICAgICAgICB2YXIgc3RhcnRBbmNob3IgPSAvXig/OlxcKFxcPzpcXCkpP1xcXi8sIC8vIExlYWRpbmcgYF5gIG9yIGAoPzopXmAgKGhhbmRsZXMgL3ggY3J1ZnQpXHJcbiAgICAgICAgICAgIGVuZEFuY2hvciA9IC9cXCQoPzpcXChcXD86XFwpKT8kLzsgLy8gVHJhaWxpbmcgYCRgIG9yIGAkKD86KWAgKGhhbmRsZXMgL3ggY3J1ZnQpXHJcbiAgICAgICAgaWYgKGVuZEFuY2hvci50ZXN0KHBhdHRlcm4ucmVwbGFjZSgvXFxcXFtcXHNcXFNdL2csIFwiXCIpKSkgeyAvLyBFbnN1cmUgdHJhaWxpbmcgYCRgIGlzbid0IGVzY2FwZWRcclxuICAgICAgICAgICAgcmV0dXJuIHBhdHRlcm4ucmVwbGFjZShzdGFydEFuY2hvciwgXCJcIikucmVwbGFjZShlbmRBbmNob3IsIFwiXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcGF0dGVybjtcclxuICAgIH1cclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0cyB0aGUgcHJvdmlkZWQgdmFsdWUgdG8gYW4gWFJlZ0V4cC5cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSB2YWx1ZSBWYWx1ZSB0byBjb252ZXJ0LlxyXG4gKiBAcmV0dXJucyB7UmVnRXhwfSBYUmVnRXhwIG9iamVjdCB3aXRoIFhSZWdFeHAgc3ludGF4IGFwcGxpZWQuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gYXNYUmVnRXhwKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIFhSZWdFeHAuaXNSZWdFeHAodmFsdWUpID9cclxuICAgICAgICAgICAgICAgICh2YWx1ZS54cmVnZXhwICYmICF2YWx1ZS54cmVnZXhwLmlzTmF0aXZlID8gdmFsdWUgOiBYUmVnRXhwKHZhbHVlLnNvdXJjZSkpIDpcclxuICAgICAgICAgICAgICAgIFhSZWdFeHAodmFsdWUpO1xyXG4gICAgfVxyXG5cclxuLyoqXHJcbiAqIEJ1aWxkcyByZWdleGVzIHVzaW5nIG5hbWVkIHN1YnBhdHRlcm5zLCBmb3IgcmVhZGFiaWxpdHkgYW5kIHBhdHRlcm4gcmV1c2UuIEJhY2tyZWZlcmVuY2VzIGluIHRoZVxyXG4gKiBvdXRlciBwYXR0ZXJuIGFuZCBwcm92aWRlZCBzdWJwYXR0ZXJucyBhcmUgYXV0b21hdGljYWxseSByZW51bWJlcmVkIHRvIHdvcmsgY29ycmVjdGx5LiBOYXRpdmVcclxuICogZmxhZ3MgdXNlZCBieSBwcm92aWRlZCBzdWJwYXR0ZXJucyBhcmUgaWdub3JlZCBpbiBmYXZvciBvZiB0aGUgYGZsYWdzYCBhcmd1bWVudC5cclxuICogQG1lbWJlck9mIFhSZWdFeHBcclxuICogQHBhcmFtIHtTdHJpbmd9IHBhdHRlcm4gWFJlZ0V4cCBwYXR0ZXJuIHVzaW5nIGB7e25hbWV9fWAgZm9yIGVtYmVkZGVkIHN1YnBhdHRlcm5zLiBBbGxvd3NcclxuICogICBgKHt7bmFtZX19KWAgYXMgc2hvcnRoYW5kIGZvciBgKD88bmFtZT57e25hbWV9fSlgLiBQYXR0ZXJucyBjYW5ub3QgYmUgZW1iZWRkZWQgd2l0aGluXHJcbiAqICAgY2hhcmFjdGVyIGNsYXNzZXMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzdWJzIExvb2t1cCBvYmplY3QgZm9yIG5hbWVkIHN1YnBhdHRlcm5zLiBWYWx1ZXMgY2FuIGJlIHN0cmluZ3Mgb3IgcmVnZXhlcy4gQVxyXG4gKiAgIGxlYWRpbmcgYF5gIGFuZCB0cmFpbGluZyB1bmVzY2FwZWQgYCRgIGFyZSBzdHJpcHBlZCBmcm9tIHN1YnBhdHRlcm5zLCBpZiBib3RoIGFyZSBwcmVzZW50LlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2ZsYWdzXSBBbnkgY29tYmluYXRpb24gb2YgWFJlZ0V4cCBmbGFncy5cclxuICogQHJldHVybnMge1JlZ0V4cH0gUmVnZXggd2l0aCBpbnRlcnBvbGF0ZWQgc3VicGF0dGVybnMuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIHZhciB0aW1lID0gWFJlZ0V4cC5idWlsZCgnKD94KV4ge3tob3Vyc319ICh7e21pbnV0ZXN9fSkgJCcsIHtcclxuICogICBob3VyczogWFJlZ0V4cC5idWlsZCgne3toMTJ9fSA6IHwge3toMjR9fScsIHtcclxuICogICAgIGgxMjogLzFbMC0yXXwwP1sxLTldLyxcclxuICogICAgIGgyNDogLzJbMC0zXXxbMDFdWzAtOV0vXHJcbiAqICAgfSwgJ3gnKSxcclxuICogICBtaW51dGVzOiAvXlswLTVdWzAtOV0kL1xyXG4gKiB9KTtcclxuICogdGltZS50ZXN0KCcxMDo1OScpOyAvLyAtPiB0cnVlXHJcbiAqIFhSZWdFeHAuZXhlYygnMTA6NTknLCB0aW1lKS5taW51dGVzOyAvLyAtPiAnNTknXHJcbiAqL1xyXG4gICAgWFJlZ0V4cC5idWlsZCA9IGZ1bmN0aW9uIChwYXR0ZXJuLCBzdWJzLCBmbGFncykge1xyXG4gICAgICAgIHZhciBpbmxpbmVGbGFncyA9IC9eXFwoXFw/KFtcXHckXSspXFwpLy5leGVjKHBhdHRlcm4pLFxyXG4gICAgICAgICAgICBkYXRhID0ge30sXHJcbiAgICAgICAgICAgIG51bUNhcHMgPSAwLCAvLyBDYXBzIGlzIHNob3J0IGZvciBjYXB0dXJlc1xyXG4gICAgICAgICAgICBudW1QcmlvckNhcHMsXHJcbiAgICAgICAgICAgIG51bU91dGVyQ2FwcyA9IDAsXHJcbiAgICAgICAgICAgIG91dGVyQ2Fwc01hcCA9IFswXSxcclxuICAgICAgICAgICAgb3V0ZXJDYXBOYW1lcyxcclxuICAgICAgICAgICAgc3ViLFxyXG4gICAgICAgICAgICBwO1xyXG5cclxuICAgICAgICAvLyBBZGQgZmxhZ3Mgd2l0aGluIGEgbGVhZGluZyBtb2RlIG1vZGlmaWVyIHRvIHRoZSBvdmVyYWxsIHBhdHRlcm4ncyBmbGFnc1xyXG4gICAgICAgIGlmIChpbmxpbmVGbGFncykge1xyXG4gICAgICAgICAgICBmbGFncyA9IGZsYWdzIHx8IFwiXCI7XHJcbiAgICAgICAgICAgIGlubGluZUZsYWdzWzFdLnJlcGxhY2UoLy4vZywgZnVuY3Rpb24gKGZsYWcpIHtcclxuICAgICAgICAgICAgICAgIGZsYWdzICs9IChmbGFncy5pbmRleE9mKGZsYWcpID4gLTEgPyBcIlwiIDogZmxhZyk7IC8vIERvbid0IGFkZCBkdXBsaWNhdGVzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChwIGluIHN1YnMpIHtcclxuICAgICAgICAgICAgaWYgKHN1YnMuaGFzT3duUHJvcGVydHkocCkpIHtcclxuICAgICAgICAgICAgICAgIC8vIFBhc3NpbmcgdG8gWFJlZ0V4cCBlbmFibGVzIGVudGVuZGVkIHN5bnRheCBmb3Igc3VicGF0dGVybnMgcHJvdmlkZWQgYXMgc3RyaW5nc1xyXG4gICAgICAgICAgICAgICAgLy8gYW5kIGVuc3VyZXMgaW5kZXBlbmRlbnQgdmFsaWRpdHksIGxlc3QgYW4gdW5lc2NhcGVkIGAoYCwgYClgLCBgW2AsIG9yIHRyYWlsaW5nXHJcbiAgICAgICAgICAgICAgICAvLyBgXFxgIGJyZWFrcyB0aGUgYCg/OilgIHdyYXBwZXIuIEZvciBzdWJwYXR0ZXJucyBwcm92aWRlZCBhcyByZWdleGVzLCBpdCBkaWVzIG9uXHJcbiAgICAgICAgICAgICAgICAvLyBvY3RhbHMgYW5kIGFkZHMgdGhlIGB4cmVnZXhwYCBwcm9wZXJ0eSwgZm9yIHNpbXBsaWNpdHlcclxuICAgICAgICAgICAgICAgIHN1YiA9IGFzWFJlZ0V4cChzdWJzW3BdKTtcclxuICAgICAgICAgICAgICAgIC8vIERlYW5jaG9yaW5nIGFsbG93cyBlbWJlZGRpbmcgaW5kZXBlbmRlbnRseSB1c2VmdWwgYW5jaG9yZWQgcmVnZXhlcy4gSWYgeW91XHJcbiAgICAgICAgICAgICAgICAvLyByZWFsbHkgbmVlZCB0byBrZWVwIHlvdXIgYW5jaG9ycywgZG91YmxlIHRoZW0gKGkuZS4sIGBeXi4uLiQkYClcclxuICAgICAgICAgICAgICAgIGRhdGFbcF0gPSB7cGF0dGVybjogZGVhbmNob3Ioc3ViLnNvdXJjZSksIG5hbWVzOiBzdWIueHJlZ2V4cC5jYXB0dXJlTmFtZXMgfHwgW119O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQYXNzaW5nIHRvIFhSZWdFeHAgZGllcyBvbiBvY3RhbHMgYW5kIGVuc3VyZXMgdGhlIG91dGVyIHBhdHRlcm4gaXMgaW5kZXBlbmRlbnRseSB2YWxpZDtcclxuICAgICAgICAvLyBoZWxwcyBrZWVwIHRoaXMgc2ltcGxlLiBOYW1lZCBjYXB0dXJlcyB3aWxsIGJlIHB1dCBiYWNrXHJcbiAgICAgICAgcGF0dGVybiA9IGFzWFJlZ0V4cChwYXR0ZXJuKTtcclxuICAgICAgICBvdXRlckNhcE5hbWVzID0gcGF0dGVybi54cmVnZXhwLmNhcHR1cmVOYW1lcyB8fCBbXTtcclxuICAgICAgICBwYXR0ZXJuID0gcGF0dGVybi5zb3VyY2UucmVwbGFjZShwYXJ0cywgZnVuY3Rpb24gKCQwLCAkMSwgJDIsICQzLCAkNCkge1xyXG4gICAgICAgICAgICB2YXIgc3ViTmFtZSA9ICQxIHx8ICQyLCBjYXBOYW1lLCBpbnRybztcclxuICAgICAgICAgICAgaWYgKHN1Yk5hbWUpIHsgLy8gTmFtZWQgc3VicGF0dGVyblxyXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmhhc093blByb3BlcnR5KHN1Yk5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidW5kZWZpbmVkIHByb3BlcnR5IFwiICsgJDApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCQxKSB7IC8vIE5hbWVkIHN1YnBhdHRlcm4gd2FzIHdyYXBwZWQgaW4gYSBjYXB0dXJpbmcgZ3JvdXBcclxuICAgICAgICAgICAgICAgICAgICBjYXBOYW1lID0gb3V0ZXJDYXBOYW1lc1tudW1PdXRlckNhcHNdO1xyXG4gICAgICAgICAgICAgICAgICAgIG91dGVyQ2Fwc01hcFsrK251bU91dGVyQ2Fwc10gPSArK251bUNhcHM7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQncyBhIG5hbWVkIGdyb3VwLCBwcmVzZXJ2ZSB0aGUgbmFtZS4gT3RoZXJ3aXNlLCB1c2UgdGhlIHN1YnBhdHRlcm4gbmFtZVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIHRoZSBjYXB0dXJlIG5hbWVcclxuICAgICAgICAgICAgICAgICAgICBpbnRybyA9IFwiKD88XCIgKyAoY2FwTmFtZSB8fCBzdWJOYW1lKSArIFwiPlwiO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpbnRybyA9IFwiKD86XCI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBudW1QcmlvckNhcHMgPSBudW1DYXBzO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGludHJvICsgZGF0YVtzdWJOYW1lXS5wYXR0ZXJuLnJlcGxhY2Uoc3VicGFydHMsIGZ1bmN0aW9uIChtYXRjaCwgcGFyZW4sIGJhY2tyZWYpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW4pIHsgLy8gQ2FwdHVyaW5nIGdyb3VwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhcE5hbWUgPSBkYXRhW3N1Yk5hbWVdLm5hbWVzW251bUNhcHMgLSBudW1QcmlvckNhcHNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArK251bUNhcHM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYXBOYW1lKSB7IC8vIElmIHRoZSBjdXJyZW50IGNhcHR1cmUgaGFzIGEgbmFtZSwgcHJlc2VydmUgdGhlIG5hbWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIig/PFwiICsgY2FwTmFtZSArIFwiPlwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChiYWNrcmVmKSB7IC8vIEJhY2tyZWZlcmVuY2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiXFxcXFwiICsgKCtiYWNrcmVmICsgbnVtUHJpb3JDYXBzKTsgLy8gUmV3cml0ZSB0aGUgYmFja3JlZmVyZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2g7XHJcbiAgICAgICAgICAgICAgICB9KSArIFwiKVwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICgkMykgeyAvLyBDYXB0dXJpbmcgZ3JvdXBcclxuICAgICAgICAgICAgICAgIGNhcE5hbWUgPSBvdXRlckNhcE5hbWVzW251bU91dGVyQ2Fwc107XHJcbiAgICAgICAgICAgICAgICBvdXRlckNhcHNNYXBbKytudW1PdXRlckNhcHNdID0gKytudW1DYXBzO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhcE5hbWUpIHsgLy8gSWYgdGhlIGN1cnJlbnQgY2FwdHVyZSBoYXMgYSBuYW1lLCBwcmVzZXJ2ZSB0aGUgbmFtZVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIig/PFwiICsgY2FwTmFtZSArIFwiPlwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCQ0KSB7IC8vIEJhY2tyZWZlcmVuY2VcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlxcXFxcIiArIG91dGVyQ2Fwc01hcFsrJDRdOyAvLyBSZXdyaXRlIHRoZSBiYWNrcmVmZXJlbmNlXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuICQwO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gWFJlZ0V4cChwYXR0ZXJuLCBmbGFncyk7XHJcbiAgICB9O1xyXG5cclxufShYUmVnRXhwKSk7XHJcblxyXG5cbi8qKioqKiBwcm90b3R5cGVzLmpzICoqKioqL1xuXG4vKiFcclxuICogWFJlZ0V4cCBQcm90b3R5cGUgTWV0aG9kcyB2MS4wLjBcclxuICogKGMpIDIwMTIgU3RldmVuIExldml0aGFuIDxodHRwOi8veHJlZ2V4cC5jb20vPlxyXG4gKiBNSVQgTGljZW5zZVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBZGRzIGEgY29sbGVjdGlvbiBvZiBtZXRob2RzIHRvIGBYUmVnRXhwLnByb3RvdHlwZWAuIFJlZ0V4cCBvYmplY3RzIGNvcGllZCBieSBYUmVnRXhwIGFyZSBhbHNvXHJcbiAqIGF1Z21lbnRlZCB3aXRoIGFueSBgWFJlZ0V4cC5wcm90b3R5cGVgIG1ldGhvZHMuIEhlbmNlLCB0aGUgZm9sbG93aW5nIHdvcmsgZXF1aXZhbGVudGx5OlxyXG4gKlxyXG4gKiBYUmVnRXhwKCdbYS16XScsICdpZycpLnhleGVjKCdhYmMnKTtcclxuICogWFJlZ0V4cCgvW2Etel0vaWcpLnhleGVjKCdhYmMnKTtcclxuICogWFJlZ0V4cC5nbG9iYWxpemUoL1thLXpdL2kpLnhleGVjKCdhYmMnKTtcclxuICovXHJcbihmdW5jdGlvbiAoWFJlZ0V4cCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogQ29weSBwcm9wZXJ0aWVzIG9mIGBiYCB0byBgYWAuXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBhIE9iamVjdCB0aGF0IHdpbGwgcmVjZWl2ZSBuZXcgcHJvcGVydGllcy5cclxuICogQHBhcmFtIHtPYmplY3R9IGIgT2JqZWN0IHdob3NlIHByb3BlcnRpZXMgd2lsbCBiZSBjb3BpZWQuXHJcbiAqL1xyXG4gICAgZnVuY3Rpb24gZXh0ZW5kKGEsIGIpIHtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGIpIHtcclxuICAgICAgICAgICAgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIHtcclxuICAgICAgICAgICAgICAgIGFbcF0gPSBiW3BdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vcmV0dXJuIGE7XHJcbiAgICB9XHJcblxyXG4gICAgZXh0ZW5kKFhSZWdFeHAucHJvdG90eXBlLCB7XHJcblxyXG4vKipcclxuICogSW1wbGljaXRseSBjYWxscyB0aGUgcmVnZXgncyBgdGVzdGAgbWV0aG9kIHdpdGggdGhlIGZpcnN0IHZhbHVlIGluIHRoZSBwcm92aWRlZCBhcmd1bWVudHMgYXJyYXkuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAcGFyYW0geyp9IGNvbnRleHQgSWdub3JlZC4gQWNjZXB0ZWQgb25seSBmb3IgY29uZ3J1aXR5IHdpdGggYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseWAuXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgQXJyYXkgd2l0aCB0aGUgc3RyaW5nIHRvIHNlYXJjaCBhcyBpdHMgZmlyc3QgdmFsdWUuXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSByZWdleCBtYXRjaGVkIHRoZSBwcm92aWRlZCB2YWx1ZS5cclxuICogQGV4YW1wbGVcclxuICpcclxuICogWFJlZ0V4cCgnW2Etel0nKS5hcHBseShudWxsLCBbJ2FiYyddKTsgLy8gLT4gdHJ1ZVxyXG4gKi9cclxuICAgICAgICBhcHBseTogZnVuY3Rpb24gKGNvbnRleHQsIGFyZ3MpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVzdChhcmdzWzBdKTtcclxuICAgICAgICB9LFxyXG5cclxuLyoqXHJcbiAqIEltcGxpY2l0bHkgY2FsbHMgdGhlIHJlZ2V4J3MgYHRlc3RgIG1ldGhvZCB3aXRoIHRoZSBwcm92aWRlZCBzdHJpbmcuXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAcGFyYW0geyp9IGNvbnRleHQgSWdub3JlZC4gQWNjZXB0ZWQgb25seSBmb3IgY29uZ3J1aXR5IHdpdGggYEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsYC5cclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc2VhcmNoLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciB0aGUgcmVnZXggbWF0Y2hlZCB0aGUgcHJvdmlkZWQgdmFsdWUuXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAoJ1thLXpdJykuY2FsbChudWxsLCAnYWJjJyk7IC8vIC0+IHRydWVcclxuICovXHJcbiAgICAgICAgY2FsbDogZnVuY3Rpb24gKGNvbnRleHQsIHN0cikge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZXN0KHN0cik7XHJcbiAgICAgICAgfSxcclxuXHJcbi8qKlxyXG4gKiBJbXBsaWNpdGx5IGNhbGxzIHtAbGluayAjWFJlZ0V4cC5mb3JFYWNofS5cclxuICogQG1lbWJlck9mIFhSZWdFeHAucHJvdG90eXBlXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIFhSZWdFeHAoJ1xcXFxkJykuZm9yRWFjaCgnMWEyMzQ1JywgZnVuY3Rpb24gKG1hdGNoLCBpKSB7XHJcbiAqICAgaWYgKGkgJSAyKSB0aGlzLnB1c2goK21hdGNoWzBdKTtcclxuICogfSwgW10pO1xyXG4gKiAvLyAtPiBbMiwgNF1cclxuICovXHJcbiAgICAgICAgZm9yRWFjaDogZnVuY3Rpb24gKHN0ciwgY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFhSZWdFeHAuZm9yRWFjaChzdHIsIHRoaXMsIGNhbGxiYWNrLCBjb250ZXh0KTtcclxuICAgICAgICB9LFxyXG5cclxuLyoqXHJcbiAqIEltcGxpY2l0bHkgY2FsbHMge0BsaW5rICNYUmVnRXhwLmdsb2JhbGl6ZX0uXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiB2YXIgZ2xvYmFsQ29weSA9IFhSZWdFeHAoJ3JlZ2V4JykuZ2xvYmFsaXplKCk7XHJcbiAqIGdsb2JhbENvcHkuZ2xvYmFsOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgICAgIGdsb2JhbGl6ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gWFJlZ0V4cC5nbG9iYWxpemUodGhpcyk7XHJcbiAgICAgICAgfSxcclxuXHJcbi8qKlxyXG4gKiBJbXBsaWNpdGx5IGNhbGxzIHtAbGluayAjWFJlZ0V4cC5leGVjfS5cclxuICogQG1lbWJlck9mIFhSZWdFeHAucHJvdG90eXBlXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIHZhciBtYXRjaCA9IFhSZWdFeHAoJ1VcXFxcKyg/PGhleD5bMC05QS1GXXs0fSknKS54ZXhlYygnVSsyNjIwJyk7XHJcbiAqIG1hdGNoLmhleDsgLy8gLT4gJzI2MjAnXHJcbiAqL1xyXG4gICAgICAgIHhleGVjOiBmdW5jdGlvbiAoc3RyLCBwb3MsIHN0aWNreSkge1xyXG4gICAgICAgICAgICByZXR1cm4gWFJlZ0V4cC5leGVjKHN0ciwgdGhpcywgcG9zLCBzdGlja3kpO1xyXG4gICAgICAgIH0sXHJcblxyXG4vKipcclxuICogSW1wbGljaXRseSBjYWxscyB7QGxpbmsgI1hSZWdFeHAudGVzdH0uXHJcbiAqIEBtZW1iZXJPZiBYUmVnRXhwLnByb3RvdHlwZVxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBYUmVnRXhwKCdjJykueHRlc3QoJ2FiYycpOyAvLyAtPiB0cnVlXHJcbiAqL1xyXG4gICAgICAgIHh0ZXN0OiBmdW5jdGlvbiAoc3RyLCBwb3MsIHN0aWNreSkge1xyXG4gICAgICAgICAgICByZXR1cm4gWFJlZ0V4cC50ZXN0KHN0ciwgdGhpcywgcG9zLCBzdGlja3kpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9KTtcclxuXHJcbn0oWFJlZ0V4cCkpO1xyXG5cclxuIiwidmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBSZXN0RXJyb3IgPSBfaS5lcnJvci5SZXN0RXJyb3JcbiAgICAsIGFzc2VydCA9IF9pLm1pc2MuYXNzZXJ0XG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IF9pLm1pc2MuZGVmaW5lU3ViUHJvcGVydHlcbiAgICAsIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeVxuICAgICwgZXh0ZW5kID0gX2kuZXh0ZW5kXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgIDtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcbi8vIFRoZSBYUmVnRXhwIG9iamVjdCBoYXMgdGhlc2UgcHJvcGVydGllcyB0aGF0IHdlIHdhbnQgdG8gaWdub3JlIHdoZW4gbWF0Y2hpbmcuXG52YXIgaWdub3JlID0gWydpbmRleCcsICdpbnB1dCddO1xudmFyIFhSZWdFeHAgPSByZXF1aXJlKCd4cmVnZXhwJykuWFJlZ0V4cDtcblxuXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgLy8gQ29udmVydCBwYXRoIHN0cmluZyBpbnRvIFhSZWdFeHAgaWYgbm90IGFscmVhZHkuXG4gICAgaWYgKHRoaXMuX29wdHMucGF0aCkge1xuICAgICAgICBpZiAoISh0aGlzLl9vcHRzLnBhdGggaW5zdGFuY2VvZiBYUmVnRXhwKSkge1xuICAgICAgICAgICAgdGhpcy5fb3B0cy5wYXRoID0gWFJlZ0V4cCh0aGlzLl9vcHRzLnBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSAnJztcbiAgICB9XG5cbiAgICAvLyBDb252ZXJ0IHdpbGRjYXJkcyBpbnRvIG1ldGhvZHMgYW5kIGVuc3VyZSBpcyBhbiBhcnJheSBvZiB1cHBlcmNhc2UgbWV0aG9kcy5cbiAgICBpZiAodGhpcy5fb3B0cy5tZXRob2QpIHtcbiAgICAgICAgaWYgKHRoaXMuX29wdHMubWV0aG9kID09ICcqJyB8fCB0aGlzLl9vcHRzLm1ldGhvZC5pbmRleE9mKCcqJykgPiAtMSkge1xuICAgICAgICAgICAgdGhpcy5fb3B0cy5tZXRob2QgPSB0aGlzLmh0dHBNZXRob2RzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZih0aGlzLl9vcHRzLm1ldGhvZCkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMubWV0aG9kID0gW3RoaXMuX29wdHMubWV0aG9kXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5fb3B0cy5tZXRob2QgPSB0aGlzLmh0dHBNZXRob2RzO1xuICAgIH1cbiAgICB0aGlzLl9vcHRzLm1ldGhvZCA9IF8ubWFwKHRoaXMuX29wdHMubWV0aG9kLCBmdW5jdGlvbiAoeCkge3JldHVybiB4LnRvVXBwZXJDYXNlKCl9KTtcblxuICAgIC8vIE1hcHBpbmdzIGNhbiBiZSBwYXNzZWQgYXMgdGhlIGFjdHVhbCBtYXBwaW5nIG9iamVjdCBvciBhcyBhIHN0cmluZyAod2l0aCBBUEkgc3BlY2lmaWVkIHRvbylcbiAgICBpZiAodGhpcy5fb3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5tYXBwaW5nKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX29wdHMuY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W3RoaXMuX29wdHMuY29sbGVjdGlvbl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gdGhpcy5fb3B0cy5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0dWFsTWFwcGluZyA9IGNvbGxlY3Rpb25bdGhpcy5fb3B0cy5tYXBwaW5nXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjdHVhbE1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX29wdHMubWFwcGluZyA9IGFjdHVhbE1hcHBpbmc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nICcgKyB0aGlzLl9vcHRzLm1hcHBpbmcgKyAnIGRvZXMgbm90IGV4aXN0Jywge29wdHM6IG9wdHMsIGRlc2NyaXB0b3I6IHRoaXN9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ29sbGVjdGlvbiAnICsgdGhpcy5fb3B0cy5jb2xsZWN0aW9uICsgJyBkb2VzIG5vdCBleGlzdCcsIHtvcHRzOiBvcHRzLCBkZXNjcmlwdG9yOiB0aGlzfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignUGFzc2VkIG1hcHBpbmcgYXMgc3RyaW5nLCBidXQgZGlkIG5vdCBzcGVjaWZ5IHRoZSBjb2xsZWN0aW9uIGl0IGJlbG9uZ3MgdG8nLCB7b3B0czogb3B0cywgZGVzY3JpcHRvcjogdGhpc30pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdEZXNjcmlwdG9ycyBtdXN0IGJlIGluaXRpYWxpc2VkIHdpdGggYSBtYXBwaW5nJywge29wdHM6IG9wdHMsIGRlc2NyaXB0b3I6IHRoaXN9KTtcbiAgICB9XG5cbiAgICAvLyBJZiBrZXkgcGF0aCwgY29udmVydCBkYXRhIGtleSBwYXRoIGludG8gYW4gb2JqZWN0IHRoYXQgd2UgY2FuIHRoZW4gdXNlIHRvIHRyYXZlcnNlIHRoZSBIVFRQIGJvZGllcy5cbiAgICAvLyBvdGhlcndpc2UgbGVhdmUgYXMgc3RyaW5nIG9yIHVuZGVmaW5lZC5cbiAgICB2YXIgZGF0YSA9IHRoaXMuX29wdHMuZGF0YTtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciByb290O1xuICAgICAgICAgICAgdmFyIGFyciA9IGRhdGEuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICByb290ID0gYXJyWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIHJvb3QgPSBvYmo7XG4gICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzS2V5ID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBhcnJbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09IChhcnIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFyID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNLZXkgPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vcHRzLmRhdGEgPSByb290O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncGF0aCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21ldGhvZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21hcHBpbmcnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdkYXRhJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAndHJhbnNmb3JtcycsIHRoaXMuX29wdHMpO1xufVxuXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5odHRwTWV0aG9kcyA9IFsnUE9TVCcsICdQQVRDSCcsICdQVVQnLCAnSEVBRCcsICdHRVQnLCAnREVMRVRFJywgJ09QVElPTlMnLCAnVFJBQ0UnLCAnQ09OTkVDVCddO1xuXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgbWF0Y2ggPSBYUmVnRXhwLmV4ZWMocGF0aCwgdGhpcy5wYXRoKTtcbiAgICB2YXIgbWF0Y2hlZCA9IG51bGw7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIG1hdGNoZWQgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBtYXRjaCkge1xuICAgICAgICAgICAgaWYgKG1hdGNoLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKHBhcnNlSW50KHByb3ApKSAmJiBpZ25vcmUuaW5kZXhPZihwcm9wKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZFtwcm9wXSA9IG1hdGNoW3Byb3BdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlZDtcbn07XG5cbkRlc2NyaXB0b3IucHJvdG90eXBlLl9tYXRjaE1ldGhvZCA9IGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBCdXJ5IG9iaiBhcyBmYXIgZG93biBpbiBkYXRhIGFzIHBvc3MuXG4gKiBAcGFyYW0gb2JqXG4gKiBAcGFyYW0gZGF0YSBrZXlwYXRoIG9iamVjdFxuICogQHJldHVybnMgeyp9XG4gKi9cbmZ1bmN0aW9uIGJ1cnkob2JqLCBkYXRhKSB7XG4gICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICB3aGlsZSAoISh0eXBlb2YoY3VycltrZXldKSA9PSAnc3RyaW5nJykpIHtcbiAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgfVxuICAgIHZhciBuZXdQYXJlbnQgPSBjdXJyW2tleV07XG4gICAgdmFyIG5ld09iaiA9IHt9O1xuICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICBuZXdPYmpbbmV3UGFyZW50XSA9IG9iajtcbiAgICByZXR1cm4gcm9vdDtcbn1cblxuRGVzY3JpcHRvci5wcm90b3R5cGUuX2VtYmVkRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICB2YXIgbmVzdGVkO1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG5lc3RlZCA9IHt9O1xuICAgICAgICAgICAgbmVzdGVkW3RoaXMuZGF0YV0gPSBkYXRhO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbmVzdGVkID0gYnVyeShkYXRhLCBleHRlbmQodHJ1ZSwge30sIHRoaXMuZGF0YSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXN0ZWQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59O1xuXG5EZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIuZGVidWcoJ19leHRyYWN0RGF0YScsIGRhdGEpO1xuICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLmRhdGEpID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YVt0aGlzLmRhdGFdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmRhdGEpO1xuICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgdmFyIGN1cnJUaGVpcnMgPSBkYXRhO1xuICAgICAgICAgICAgdmFyIGN1cnJPdXJzID0gdGhpcy5kYXRhO1xuICAgICAgICAgICAgd2hpbGUgKHR5cGVvZihjdXJyT3VycykgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoY3Vyck91cnMpO1xuICAgICAgICAgICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgICAgICBjdXJyT3VycyA9IGN1cnJPdXJzW2tleV07XG4gICAgICAgICAgICAgICAgY3VyclRoZWlycyA9IGN1cnJUaGVpcnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoIWN1cnJUaGVpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGN1cnJUaGVpcnMgPyBjdXJyVGhlaXJzW2N1cnJPdXJzXSA6IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gKiBAcGFyYW0gY29uZmlnXG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cbkRlc2NyaXB0b3IucHJvdG90eXBlLl9tYXRjaENvbmZpZyA9IGZ1bmN0aW9uIChjb25maWcpIHtcbiAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgbWF0Y2hlcyA9IGNvbmZpZy51cmwgPyB0aGlzLl9tYXRjaFBhdGgoY29uZmlnLnVybCkgOiB7fTtcbiAgICB9XG4gICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ21hdGNoZWQgY29uZmlnJyk7XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVzO1xufTtcblxuRGVzY3JpcHRvci5wcm90b3R5cGUuX21hdGNoRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGV4dHJhY3RlZERhdGEgPSBudWxsO1xuICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9leHRyYWN0RGF0YShkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRhdGE7XG4gICAgfVxuICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnbWF0Y2hlZCBkYXRhJyk7XG4gICAgfVxuICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xufTtcblxuRGVzY3JpcHRvci5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbiAoY29uZmlnLCBkYXRhKSB7XG4gICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgdmFyIG1hdGNoZXMgPSAhIXJlZ2V4TWF0Y2hlcztcbiAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IGZhbHNlO1xuICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIG1hdGNoZXMnKTtcbiAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX21hdGNoRGF0YShkYXRhKTtcbiAgICAgICAgbWF0Y2hlcyA9ICEhZXh0cmFjdGVkRGF0YTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIHZhciBrZXk7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGV4dHJhY3RlZERhdGEpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gcmVnZXhNYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWdleE1hdGNoZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGV4dHJhY3RlZERhdGEsIGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtW2tleV0gPSByZWdleE1hdGNoZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gcmVnZXhNYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWdleE1hdGNoZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YVtrZXldID0gcmVnZXhNYXRjaGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnZGF0YSBtYXRjaGVzJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2RhdGEgZG9lc250IG1hdGNoJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIGRvZXNudCBtYXRjaCcpO1xuICAgIH1cbiAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbn07XG5cbkRlc2NyaXB0b3IucHJvdG90eXBlLl90cmFuc2Zvcm1EYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICB2YXIgdHJhbnNmb3JtcyA9IHRoaXMudHJhbnNmb3JtcztcbiAgICBmb3IgKHZhciBhdHRyIGluIHRyYW5zZm9ybXMpIHtcbiAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgIGlmIChkYXRhW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRyYW5zZm9ybXNbYXR0cl07XG4gICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzcGxpdCA9IHRyYW5zZm9ybS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NwbGl0WzBdXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFsID0gZGF0YVtzcGxpdFswXV07XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdBdHRyID0gc3BsaXRbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsW25ld0F0dHJdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsW3NwbGl0W3NwbGl0Lmxlbmd0aCAtIDFdXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRyYW5zZm9ybWVkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3RyYW5zZm9ybWVkWzBdXSA9IHRyYW5zZm9ybWVkWzFdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVthdHRyXSA9IHRyYW5zZm9ybWVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdJbnZhbGlkIHRyYW5zZm9ybWVyJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuXG5leHBvcnRzLkRlc2NyaXB0b3IgPSBEZXNjcmlwdG9yOyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWw7XG52YXIgbG9nID0gX2kubG9nO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvclJlZ2lzdHJ5Jyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgYXNzZXJ0ID0gX2kubWlzYy5hc3NlcnQ7XG5cblxuZnVuY3Rpb24gRGVzY3JpcHRvclJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3JSZWdpc3RyeShvcHRzKTtcbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbn1cblxuZnVuY3Rpb24gX3JlZ2lzdGVyRGVzY3JpcHRvcihkZXNjcmlwdG9ycywgZGVzY3JpcHRvcikge1xuICAgIHZhciBtYXBwaW5nID0gZGVzY3JpcHRvci5tYXBwaW5nO1xuICAgIHZhciBjb2xsZWN0aW9uID0gbWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIGFzc2VydChtYXBwaW5nKTtcbiAgICBhc3NlcnQoY29sbGVjdGlvbik7XG4gICAgYXNzZXJ0KHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyk7XG4gICAgaWYgKCFkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSkge1xuICAgICAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXS5wdXNoKGRlc2NyaXB0b3IpO1xufVxuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3IgPSBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCByZXF1ZXN0RGVzY3JpcHRvcik7XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yID0gZnVuY3Rpb24gKHJlc3BvbnNlRGVzY3JpcHRvcikge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIHJlc3BvbnNlRGVzY3JpcHRvcik7XG59O1xuXG5mdW5jdGlvbiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKGRlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICBpZiAodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dIHx8IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gKGRlc2NyaXB0b3JzW2NvbGxlY3Rpb24uX25hbWVdIHx8IFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbn1cblxuRGVzY3JpcHRvclJlZ2lzdHJ5LnByb3RvdHlwZS5yZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICByZXR1cm4gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gcmVzcG9uc2UgZGVzY3JpcHRvcnMgZm9yIGNvbGxlY3Rpb24gJywgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzKTtcbiAgICB9XG4gICAgcmV0dXJuICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG59O1xuXG5EZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG59O1xuXG5leHBvcnRzLkRlc2NyaXB0b3JSZWdpc3RyeSA9IG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIGlmICghc2llc3RhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgc2llc3RhJyk7XG4gICAgfVxuXG4gICAgdmFyIENvbGxlY3Rpb24gPSBzaWVzdGEuQ29sbGVjdGlvblxuICAgICAgICAsIGxvZyA9IHNpZXN0YS5faW50ZXJuYWwubG9nXG4gICAgICAgICwgdXRpbCA9IHNpZXN0YS5faW50ZXJuYWwudXRpbFxuICAgICAgICAsIHEgPSBzaWVzdGEuX2ludGVybmFsLnFcbiAgICAgICAgO1xuXG4gICAgdmFyIERlc2NyaXB0b3JSZWdpc3RyeSA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5O1xuXG4gICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnSFRUUCcpO1xuICAgIExvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbiAgICBpZiAoIXNpZXN0YS5leHQpIHtcbiAgICAgICAgc2llc3RhLmV4dCA9IHt9O1xuICAgIH1cblxuICAgIHNpZXN0YS5leHQuaHR0cCA9IHtcbiAgICAgICAgUmVxdWVzdERlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVxdWVzdERlc2NyaXB0b3InKS5SZXF1ZXN0RGVzY3JpcHRvcixcbiAgICAgICAgUmVzcG9uc2VEZXNjcmlwdG9yOiByZXF1aXJlKCcuL3Jlc3BvbnNlRGVzY3JpcHRvcicpLlJlc3BvbnNlRGVzY3JpcHRvcixcbiAgICAgICAgRGVzY3JpcHRvcjogcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcixcbiAgICAgICAgU2VyaWFsaXNlcjogcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyksXG4gICAgICAgIERlc2NyaXB0b3JSZWdpc3RyeTogcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnlcbiAgICB9O1xuXG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGUuX2h0dHBSZXNwb25zZSA9IGZ1bmN0aW9uIChtZXRob2QsIHBhdGgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIHZhciBjYWxsYmFjaztcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9uYW1lO1xuICAgICAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICAgICAgaWYgKCFvcHRzLnVybCkgeyAvLyBBbGxvdyBvdmVycmlkZXMuXG4gICAgICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgICAgIH1cbiAgICAgICAgb3B0cy5zdWNjZXNzID0gZnVuY3Rpb24gKGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2Uob3B0cy50eXBlICsgJyAnICsganFYSFIuc3RhdHVzICsgJyAnICsgb3B0cy51cmwgKyAnOiAnICsgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgNCkpO1xuICAgICAgICAgICAgdmFyIHJlc3AgPSB7ZGF0YTogZGF0YSwgdGV4dFN0YXR1czogdGV4dFN0YXR1cywganFYSFI6IGpxWEhSfTtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihzZWxmKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICAgICAgICAgIHZhciBleHRyYWN0ZWREYXRhO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGVzY3JpcHRvci5tYXRjaChvcHRzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01hcHBpbmcgZXh0cmFjdGVkIGRhdGE6ICcgKyBKU09OLnN0cmluZ2lmeShleHRyYWN0ZWREYXRhLCBudWxsLCA0KSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZihleHRyYWN0ZWREYXRhKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IG1hdGNoZWREZXNjcmlwdG9yLm1hcHBpbmc7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcubWFwKGV4dHJhY3RlZERhdGEsIGZ1bmN0aW9uIChlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBvYmosIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRzLm9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBNYXRjaGVkLCBidXQgbm8gZGF0YS5cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdHJ1ZSwgcmVzcCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhIGJ1ZyB3aGVyZSBjb2xsZWN0aW9uIG5hbWUgZG9lc24ndCBleGlzdC4gSWYgdGhpcyBvY2N1cnMsIHRoZW4gd2lsbCBuZXZlciBnZXQgaG9sZCBvZiBhbnkgZGVzY3JpcHRvcnMuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1VubmFtZWQgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBvcHRzLmVycm9yID0gZnVuY3Rpb24gKGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xuICAgICAgICAgICAgdmFyIHJlc3AgPSB7anFYSFI6IGpxWEhSLCB0ZXh0U3RhdHVzOiB0ZXh0U3RhdHVzLCBlcnJvclRocm93bjogZXJyb3JUaHJvd259O1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXNwLCBudWxsLCByZXNwKTtcbiAgICAgICAgfTtcbiAgICAgICAgJC5hamF4KG9wdHMpO1xuICAgIH07XG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGUuX2h0dHBSZXF1ZXN0ID0gZnVuY3Rpb24gKG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICB2YXIgY2FsbGJhY2s7XG4gICAgICAgIHZhciBvcHRzID0ge307XG4gICAgICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiAoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpO1xuICAgICAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcyk7XG4gICAgICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICAgICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0RGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0RGVzY3JpcHRvci5fbWF0Y2hDb25maWcob3B0cykpIHtcbiAgICAgICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIGRlc2NyaXB0b3I6ICcgKyBtYXRjaGVkRGVzY3JpcHRvci5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvci5fc2VyaWFsaXNlKG9iamVjdCwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnLCB7ZXJyOiBlcnIsIGRhdGE6IGRhdGF9KTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBudWxsLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdHMuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgIG9wdHMub2JqID0gb2JqZWN0O1xuICAgICAgICAgICAgICAgICAgICBfLnBhcnRpYWwoc2VsZi5faHR0cFJlc3BvbnNlLCBtZXRob2QsIHBhdGgsIG9wdHMsIGNhbGxiYWNrKS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdEaWQgbm90IG1hdGNoIGRlc2NyaXB0b3InKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbn0pKCk7IiwidmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yXG4gICAgLCBTZXJpYWxpc2VyID0gcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyk7XG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAsIHEgPSBfaS5xXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IF9pLm1pc2MuZGVmaW5lU3ViUHJvcGVydHlcbjtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUmVxdWVzdERlc2NyaXB0b3InKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbmZ1bmN0aW9uIFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXF1ZXN0RGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG5cblxuICAgIGlmICh0aGlzLl9vcHRzWydzZXJpYWxpemVyJ10pIHtcbiAgICAgICAgdGhpcy5fb3B0cy5zZXJpYWxpc2VyID0gdGhpcy5fb3B0c1snc2VyaWFsaXplciddO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fb3B0cy5zZXJpYWxpc2VyKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IFNlcmlhbGlzZXIuZGVwdGhTZXJpYWxpemVyKDApO1xuICAgIH1cblxuXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc2VyaWFsaXNlcicsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGl6ZXInLCB0aGlzLl9vcHRzLCAnc2VyaWFsaXNlcicpO1xuXG59XG5cblJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGVzY3JpcHRvci5wcm90b3R5cGUpO1xuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUuX3NlcmlhbGlzZSA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICB2YXIgZmluaXNoZWQ7XG4gICAgdmFyIGRhdGEgPSB0aGlzLnNlcmlhbGlzZXIob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgIHNlbGYuX3RyYW5zZm9ybURhdGEoZGF0YSk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgZG9lc250IHVzZSBhIGNhbGxiYWNrJyk7XG4gICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgdXNlcyBhIGNhbGxiYWNrJywgdGhpcy5zZXJpYWxpc2VyKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgb2JqLm1hcHBpbmcgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICBvYmoucGF0aCA9IHRoaXMuX3Jhd09wdHMucGF0aDtcbiAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICBpZiAodHlwZW9mKHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBzZXJpYWxpc2VyID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBzZXJpYWxpc2VyID0gdGhpcy5fcmF3T3B0cy5zZXJpYWxpc2VyO1xuICAgIH1cbiAgICBvYmouc2VyaWFsaXNlciA9IHNlcmlhbGlzZXI7XG4gICAgdmFyIHRyYW5zZm9ybXMgPSB7fTtcbiAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIG9iai50cmFuc2Zvcm1zID0gdHJhbnNmb3JtcztcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbn07XG5cbmV4cG9ydHMuUmVxdWVzdERlc2NyaXB0b3IgPSBSZXF1ZXN0RGVzY3JpcHRvcjtcbiIsInZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcjtcblxuZnVuY3Rpb24gUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZURlc2NyaXB0b3Iob3B0cyk7XG4gICAgfVxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbn1cblxuUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGVzY3JpcHRvci5wcm90b3R5cGUpO1xuXG5SZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlLl9leHRyYWN0RGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbn07XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUuX21hdGNoRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG59O1xuXG5SZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmoubWV0aG9kcyA9IHRoaXMubWV0aG9kO1xuICAgIG9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgdmFyIHRyYW5zZm9ybXMgPSB7fTtcbiAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIG9iai50cmFuc2Zvcm1zID0gdHJhbnNmb3JtcztcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbn07XG5cbmV4cG9ydHMuUmVzcG9uc2VEZXNjcmlwdG9yID0gUmVzcG9uc2VEZXNjcmlwdG9yOyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWw7XG5cbnZhciBsb2cgPSBfaS5sb2dcbiAgICAsIHV0aWxzID0gX2kudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzZXInKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgXyA9IHV0aWxzLl87XG5cbmZ1bmN0aW9uIGlkU2VyaWFsaXNlcihvYmopIHtcbiAgICB2YXIgaWRGaWVsZCA9IG9iai5tYXBwaW5nLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlcHRoU2VyaWFsaXNlcihkZXB0aCwgb2JqLCBkb25lKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnZGVwdGhTZXJpYWxpc2VyJyk7XG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICBfLmVhY2gob2JqLl9maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXTtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlbGF0aW9uc2hpcEZpZWxkJywgZik7XG4gICAgICAgIHZhciBwcm94eSA9IG9ialtmICsgJ1Byb3h5J107XG4gICAgICAgIGlmIChwcm94eS5pc0ZvcndhcmQpIHsgLy8gQnkgZGVmYXVsdCBvbmx5IGZvcndhcmQgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYpO1xuICAgICAgICAgICAgd2FpdGluZy5wdXNoKGYpO1xuICAgICAgICAgICAgcHJveHkuZ2V0KGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdwcm94eS5nZXQnLCBmKTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYsIHYpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHZbb2JqW2YgKyAnUHJveHknXS5mb3J3YXJkTWFwcGluZy5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVwdGhTZXJpYWxpc2VyKGRlcHRoIC0gMSwgdiwgZnVuY3Rpb24gKGVyciwgc3ViRGF0YSwgcmVzcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbZl0gPSBzdWJEYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdiwgcmVzcDogcmVzcH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCwgZGF0YSwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ25vIHZhbHVlIGZvciAnICsgZik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgIGlmICgod2FpdGluZy5sZW5ndGggPT0gZmluaXNoZWQubGVuZ3RoKSAmJiBkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGlmIChkb25lKSBkb25lKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmRlcHRoU2VyaWFsaXplciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuaWRTZXJpYWxpemVyID0gaWRTZXJpYWxpc2VyO1xuZXhwb3J0cy5pZFNlcmlhbGlzZXIgPSBpZFNlcmlhbGlzZXI7XG5cbiJdfQ==
