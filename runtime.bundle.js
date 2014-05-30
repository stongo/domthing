!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.RUNTIME=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var reduceKeypath = _dereq_('./lib/reduce-keypath');
var streamCombiner = _dereq_('./lib/tiny-stream-combiner');

var combinators = module.exports.combinators = {
    concat: function (/*args...*/) {
        return [].join.apply(arguments, ' ');
    }
};

module.exports.combine = function (node, context, attributeName, method, args) {
    var expressions = [];
    var keys = args;
    var vals = args.map(function (v) {
        if (v.type === 'Literal') return v.value;
        if (v.type === 'Expression') {
            expressions.push(v.expression);
            return reduceKeypath(context, v.expression);
        }
    });
    
    if (!combinators[method]) throw new Error('Unknown combinator: "' + method + '"');

    var combiner = streamCombiner(keys, vals, combinators[method]);
    combiner.on('change', function (newValue) {
        node.setAttribute(attributeName, newValue);
    });
    node.setAttribute(attributeName, combiner.value);

    expressions.forEach(function () {
        this.addCallback(expression, function (value) {
            combiner[expression] = value;
        });
    }.bind(this));
};

module.exports.textBinding = function (node, context, keypath) {
    this.addCallback(keypath, function (value) {
        node.data = value;
    });
    node.data = reduceKeypath(context, keypath);
};

module.exports.attribute = function (node, context, attributeName, expression) {
    this.addCallback(expression, function (value) {
        node.setAttribute(attributeName, value);
    });
    node.setAttribute(attributeName, reduceKeypath(context, expression));
};

module.exports.if = function (parent, context, expression, body, alternate) {
    var elements, newElements;
    //FIXME: need to wrap in a div, ugh

    var trueDiv = document.createElement('div');
    var falseDiv = document.createElement('div');

    body(trueDiv);
    alternate(falseDiv);

    var previousValue;
    var currentElement;

    var render = function (value, force) {
        var newElement;
        value = !!value;

        if (previousValue !== value || force) {
            newElement = value ? trueDiv : falseDiv;

            if (!currentElement) {
                parent.appendChild(newElement);
            } else {
                currentElement.parentNode.replaceChild(newElement, currentElement);
            }

            currentElement = newElement;
            previousValue = value;
        }
    };

    render(reduceKeypath(context, expression), true);
    this.addCallback(expression, render);
};

},{"./lib/reduce-keypath":2,"./lib/tiny-stream-combiner":3}],2:[function(_dereq_,module,exports){
module.exports = function reduceKeypath(context, keypath) {
    var path = keypath.trim().split('.');
    return path.reduce(function (obj, path) {
        return obj && obj[path];
    }, context);
}

},{}],3:[function(_dereq_,module,exports){
var Events = _dereq_('backbone-events-standalone');

module.exports = function (keys, initialValues, combine) {
    var emitter = Events.mixin({});
    var values = {};

    var update = function (options) {
        options = options || {};

        var newValue = combine.apply(combine, keys.map(function (k) { return emitter[k]; }));

        if (newValue !== emitter.value) {
            if (!options.silent) {
                emitter.trigger('change', newValue, { previous: emitter.value });
            }
            emitter.value = newValue;
        }
    };

    keys.forEach(function (key, i) {
        values[key] = initialValues[i];
        Object.defineProperty(emitter, key, {
            get: function () {
                return values[key];
            },
            set: function (newValue) {
                values[key] = newValue;
                update();
            }
        });
    });

    update({ silent: true });

    return emitter;
};

},{"backbone-events-standalone":5}],4:[function(_dereq_,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      breaker = {},
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys,

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              if (iterator.call(context, obj[key], key, obj) === breaker) return;
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof define === "function") {
    define(function() {
      return Events;
    });
  } else if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],5:[function(_dereq_,module,exports){
module.exports = _dereq_('./backbone-events-standalone');

},{"./backbone-events-standalone":4}],6:[function(_dereq_,module,exports){
function KeyTreeStore() {
    this.storage = {};
}

// add an object to the store
KeyTreeStore.prototype.add = function (keypath, obj) {
    var arr = this.storage[keypath] || (this.storage[keypath] = []);
    arr.push(obj);
};

// remove an object
KeyTreeStore.prototype.remove = function (obj) {
    var path, arr;
    for (path in this.storage) {
        arr = this.storage[path];
        arr.some(function (item, index) {
            if (item === obj) {
                arr.splice(index, 1);
                return true;
            }
        });
    }
};

// grab all relevant objects
KeyTreeStore.prototype.get = function (keypath) {
    var keys = Object.keys(this.storage);
    var res = [];

    keys.forEach(function (key) {
        if (key.indexOf(keypath) !== -1) {
            res = res.concat(this.storage[key]);
        }
    }, this);

    return res;
};

module.exports = KeyTreeStore;

},{}],7:[function(_dereq_,module,exports){
var KeyTreeStore = _dereq_('key-tree-store');
KeyTreeStore.prototype.keys = function (keypath) {
    var keys = Object.keys(this.storage);
    return keys.filter(function (k) {
        return (k.indexOf(keypath) === 0); 
    });
};

var reduceKeypath = _dereq_('./lib/reduce-keypath');

function relativeKeypath(from, to) {
    from = from.trim();
    to = to.trim();

    if (to.indexOf(from + '.') !== 0) {
        throw new Error('Cannot get to "' + to + '" from "' + from + '"');
    }
    return to.substr(from.length + 1);
}

function Template () {
    this._callbacks = new KeyTreeStore();
    this._changes = {};
    this.html = document.createDocumentFragment();
    this.renderQueued = false;
    window.templates = window.templates || [];
    window.templates.push(this);
}

Template.prototype.update = function (keypath, value) {
    var keys = this._callbacks.keys(keypath);
    var self = this;

    keys.forEach(function (key) {
        if (key === keypath) {
            self._changes[key] = value;
        } else {
            self._changes[key] = reduceKeypath(value, relativeKeypath(keypath, key));
        }
    });

    if (!this.renderQueued) this.queueRender();
};

Template.prototype.queueRender = function () {
    window.requestAnimationFrame(this.doRender.bind(this));
    this.renderQueued = true;
};

Template.prototype._update = function (keypath, value) {
    if (this._callbacks.storage[keypath]) {
        this._callbacks.storage[keypath].forEach(function (cb) {
            cb(value);
        });
    }
};

Template.prototype.doRender = function () {
    var self = this;
    Object.keys(this._changes).forEach(function (keypath) {
        self._update(keypath, self._changes[keypath]);
    });
    this._changes = {};
    this.renderQueued = false;
};

Template.prototype.addCallback = function(keypath, cb) {
    this._callbacks.add(keypath, cb);
};

module.exports = {
    helpers: _dereq_('./helpers'),
    Template: Template
};

},{"./helpers":1,"./lib/reduce-keypath":2,"key-tree-store":6}]},{},[7])
(7)
});