'use strict';

var typeOf = require('type-of'),
  _ = require('lodash'),
  assert = require('assert'),
  format = require('util').format,

  MESSAGE = 'Incompatible type for parameter %d: Expected [%s]; got [%s]',

  type,
  apply,
  isType,
  noop,
  typeMap,
  validators,
  decorate,
  isFunction,
  validatorMap,
  types,
  guide,
  decorator,
  sift;

type = function type(value) {
  if (arguments.length > 1) {
    return _(arguments)
      .toArray()
      .map(typeOf)
      .value();
  }
  return typeOf(value);
};

isType = function isType(value, types) {
  if (type(types) !== 'array') {
    types = [types];
  }
  return _.contains(types, type(value));
};

noop = function noop() {
};

sift = function sift(value) {
  if (type(value) === 'array') {
    return this.filter.apply(this, arguments);
  }
  return this.pick.apply(this, arguments);
};

isFunction = function isFunction(value) {
  return type(value) === 'function';
};

guide = function guide(value, fn_name, guidelines) {
  if (isFunction(value)) {
    return decorate(value, guidelines);
  }
  _.each(sift(value, isFunction), function (fn, key) {
    value[key] = decorate(fn, guidelines);
  });
};

apply = function apply(fn, ctx) {
  return function () {
    fn.apply(ctx || null, arguments);
  };
};

typeMap = function typeMap(object) {
  return function (value) {
    if (isFunction(object.empty) && _.isEmpty(value)) {
      return object.empty.apply(null, arguments);
    }
    if (isFunction(object.container) && _.isObject(value)) {
      return object.container.apply(null, arguments);
    }
    if (isFunction(object.primitive) && isType(value, ['string', 'number', 'boolean'])) {
      return object.primitive.apply(null, arguments);
    }
    if (isFunction(object[type(value)])) {
      return object[type(value)].apply(null, arguments);
    }
    if (isFunction(object['default'])) {
      return object.default.call(null, value);
    }
    return value;
  };
};
typeMap.$guidelines = [
  // typeMap accepts one argument
  {
    // its type is object
    type: {},
    // if not specified, the `default` property of this object
    // is {@link _.identity}.
    'defaults': {
      'default': _.identity
    }
  }
];

validators = {
  'string': function validateString(typespec, index) {
    var msg = _.partial(format, MESSAGE, index, typespec);
    return function (value) {
      var t = type(value);
      assert(t === typespec, msg(t));
    };
  },
  'array': function validateArray(typespec, index) {
    var msg = _.partial(format, MESSAGE, index, typespec.join(', '));
    return function (value) {
      var t = type(value);
      assert(_.contains(typespec, t), msg(t));
    };
  },
  'function': function validateFunction(fn) {
    return fn;
  },
  'object': function validateObject(def, index) {
    var types = def.types,
      validators = [];

    if (type(types) === 'object') {
      validators.push((function (main_processor, sub_processors) {
        return function (value) {
          main_processor(value);
          _.each(value, function (value, name) {
            sub_processors[name] && sub_processors[name](value);
          });
        };
      })(validators.string('object', index), _.mapValues(types, validatorMap)));
    }
    else {
      validators.push.apply(validators, _.map(types, validatorMap));
    }

    return function (value) {
      _.each(validators, function (fn) {
        fn(value);
      });
    };
  },
  'empty': noop
};

validatorMap = typeMap(validators);


decorator = function decorator(fn, guidelines) {
  var validators,
    defaults,
    dflt,
    populators;

  guidelines = guidelines || fn.$guidelines;
  if (!guidelines) {
    return fn;
  }
  //todo use guidelines
  validators = _.map(guidelines, validatorMap);
  populators = _.map(guidelines, function (def) {
    if (type(def) === 'object') {
      dflt = def.default;
      defaults = def.defaults;
      if (dflt) {
        return function (value) {
          if (type(value) === 'undefined') {
            return dflt;
          }
          return value;
        };
      }
      else if (defaults) {
        return function (value) {
          return _.defaults(value, defaults);
        };
      }
      return _.identity;
    }
  });

  return function () {
    var args = _.toArray(arguments),
      checkArg,
      idx,
      i,
      begin,
      goodArgs;

    if (args.length < fn.length) {
      checkArg = function (arg, idx) {
        if (!goodArgs[idx]) {
          try {
            validators[idx](arg);
            goodArgs[idx] = true;
          }
          catch (ignored) {
            args.splice(idx, 0, undefined);
            return false;
          }
        }
      };
      idx = begin = 0;
      goodArgs = {};
      while (true) {
        for (i = idx; i < fn.length; i++) {
          if (checkArg(args[idx]) === false) {
            break;
          }
        }

        idx = _.keys(goodArgs).length;
        if (idx === fn.length) {
          break;
        }
        if (args.length === fn.length) {
        }
      }
    }

  };
};
