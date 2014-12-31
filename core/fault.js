/**
 * A fault occurs when we try to access a property that has not been loaded from disk
 * @param {RelationshipProxy} proxy
 * @constructor
 */
function Fault(proxy) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            return self.proxy.isFault;
        },
        enumerable: true,
        configurable: true
    });
}

_.extend(Fault.prototype, {
    get: function () {
        this.proxy.get.apply(this.proxy, arguments);
    },
    set: function () {
        this.proxy.set.apply(this.proxy, arguments);
    }
});

module.exports = Fault;