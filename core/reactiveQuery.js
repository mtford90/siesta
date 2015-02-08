/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */


(function () {

    var log = require('./log')('Query'),
        Query = require('./Query'),
        EventEmitter = require('events').EventEmitter,
        events = require('./events'),
        modelEvents = require('./modelEvents'),
        InternalSiestaError = require('./error').InternalSiestaError,
        constructQuerySet = require('./QuerySet'),
        util = require('./util'),
        _ = util._;

    /**
     *
     * @param {Query} query - The underlying query
     * @constructor
     */
    function ReactiveQuery(query) {
        var self = this;
        EventEmitter.call(this);

        _.extend(this, {
            _query: query,
            results: constructQuerySet([], query.model),
            insertionPolicy: ReactiveQuery.InsertionPolicy.Back,
            initialised: false
        });

        Object.defineProperties(this, {
            initialized: {
                get: function () {
                    return this.initialised
                }
            },
            model: {
                get: function () {
                    return self._query.model
                }
            },
            collection: {
                get: function () {
                    return self.model.collectionName
                }
            }
        });
    }

    ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

    _.extend(ReactiveQuery, {
        InsertionPolicy: {
            Front: 'Front',
            Back: 'Back'
        }
    });

    _.extend(ReactiveQuery.prototype, {
        /**
         *
         * @param cb
         * @param {bool} _ignoreInit - execute query again, initialised or not.
         * @returns {*}
         */
        init: function (cb, _ignoreInit) {
            if (log) log('init');
            return util.promise(cb, function (cb) {
                if ((!this.initialised) || _ignoreInit) {
                    this._query.execute(function (err, results) {
                        if (!err) {
                            this.results = results;
                            if (!this.handler) {
                                var name = this._constructNotificationName();
                                var handler = function (n) {
                                    this._handleNotif(n);
                                }.bind(this);
                                this.handler = handler;
                                events.on(name, handler);
                            }
                            if (log) log('Listening to ' + name);
                            this.initialised = true;
                            cb(null, this.results);
                        }
                        else {
                            cb(err);
                        }
                    }.bind(this));
                }
                else {
                    cb(null, this.results);
                }
            }.bind(this));
        },
        insert: function (newObj) {
            var results = this.results.mutableCopy();
            if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) {
                var idx = results.push(newObj);
            }
            else {
                idx = results.unshift(newObj);
            }
            this.results = results.asModelQuerySet(this.model);
            return idx;
        },
        /**
         * Execute the underlying query again.
         * @param cb
         */
        update: function (cb) {
            return this.init(cb, true)
        },
        _handleNotif: function (n) {
            log('_handleNotif', n);
            if (n.type == modelEvents.ModelEventType.New) {
                var newObj = n.new;
                if (this._query.objectMatchesQuery(newObj)) {
                    log('New object matches', newObj._dumpString());
                    var idx = this.insert(newObj);
                    this.emit('change', {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                }
                else {
                    log('New object does not match', newObj._dumpString());
                }
            }
            else if (n.type == modelEvents.ModelEventType.Set) {
                newObj = n.obj;
                var index = this.results.indexOf(newObj),
                    alreadyContains = index > -1,
                    matches = this._query.objectMatchesQuery(newObj);
                if (matches && !alreadyContains) {
                    log('Updated object now matches!', newObj._dumpString());
                    idx = this.insert(newObj);
                    this.emit('change', {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                }
                else if (!matches && alreadyContains) {
                    log('Updated object no longer matches!', newObj._dumpString());
                    results = this.results.mutableCopy();
                    var removed = results.splice(index, 1);
                    this.results = results.asModelQuerySet(this.model);
                    this.emit('change', {
                        index: index,
                        obj: this,
                        new: newObj,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                }
                else if (!matches && !alreadyContains) {
                    log('Does not contain, but doesnt match so not inserting', newObj._dumpString());
                }
                else if (matches && alreadyContains) {
                    log('Matches but already contains', newObj._dumpString());
                    // Send the notification over.
                    this.emit('change', n);
                }
            }
            else if (n.type == modelEvents.ModelEventType.Remove) {
                newObj = n.obj;
                var results = this.results.mutableCopy();
                index = results.indexOf(newObj);
                if (index > -1) {
                    log('Removing object', newObj._dumpString());
                    removed = results.splice(index, 1);
                    this.results = constructQuerySet(results, this.model);
                    this.emit('change', {
                        index: index,
                        obj: this,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                }
                else {
                    log('No modelEvents neccessary.', newObj._dumpString());
                }
            }
            else {
                throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
            }
            this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
        },
        _constructNotificationName: function () {
            return this.model.collectionName + ':' + this.model.name;
        },
        terminate: function () {
            if (this.handler) {
                events.removeListener(this._constructNotificationName(), this.handler);
            }
            this.results = null;
            this.handler = null;
        },
        listen: function (fn) {
            this.on('change', fn);
            return function () {
                this.removeListener('change', fn);
            }.bind(this);
        },
        listenOnce: function (fn) {
            this.once('change', fn);
        }
    });

    module.exports = ReactiveQuery;
})();