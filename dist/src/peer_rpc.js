"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var helper_1 = require("./helper");
var remote_procedure_call = /** @class */ (function () {
    function remote_procedure_call(send_function) {
        this.function_register = {};
        this.instances = {};
        this.sendfunction = send_function;
    }
    /**
     * get the registered function
     *
     * @param {string} fname String under which function is registered
     */
    remote_procedure_call.prototype.get_function = function (fname) {
        this.function_register[fname] = this.function_register[fname] || helper_1.create_promise_object();
        return this.function_register[fname].promise;
    };
    /**
     * serializes argument_list for use in remote call. All arguments get replaced by object
     * representing the argument with type and value. Function are registered with an
     * internal id that replace the value.
     *
     * @param {Array} argument_list argument list to serialize
     */
    remote_procedure_call.prototype.serialize_arguments = function (argument_list) {
        var _this = this;
        return argument_list.map(function (value) {
            var result = {
                type: typeof value,
                value: value
            };
            if (value instanceof Function) {
                result.value = helper_1.generate_id('xxxxxxxxxx', 36);
                _this.register_function(result.value, value);
            }
            return result;
        });
    };
    /**
     * deserializes arguments from a call_string
     *
     * @param {Array} argument_array Array of arguments
     *
     * @returns deserialized arguments
     */
    remote_procedure_call.prototype.deserialize_arguments = function (argument_array) {
        var _this = this;
        return argument_array
            .map(function (_a) {
            var type = _a.type, value = _a.value;
            if (type == 'function') {
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return _this.sendfunction(JSON.stringify([
                        'call',
                        value,
                        _this.serialize_arguments(args)
                    ]));
                };
            }
            return value;
        });
    };
    /**
     * Register a function or a class for remote call.
     *
     * @param {string} fname name under which the function shall be registered
     * @param {Function} f function that shall be registered
     */
    remote_procedure_call.prototype.register_function = function (fname, f) {
        if ((typeof f == 'undefined') && fname instanceof Function) {
            f = fname;
            fname = f.name;
        }
        this.get_function(fname); // this ensure existence of function
        this.function_register[fname].resolve(f);
    };
    ;
    /**
     * Call a function on remote side. The function call is serialized and
     * the registered send function invoked.
     *
     * @param {string} fname string under which function was registered
     * @param  {...any} args arguments for the function call
     *
     * @returns result of the sendfunction
     */
    remote_procedure_call.prototype.call_function = function (fname) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return this.sendfunction(JSON.stringify([
            'call',
            fname,
            this.serialize_arguments(args)
        ]));
    };
    /**
     * deserializes function call string and executes function or instantiates class
     *
     * @param {string} call_string this is the serialized representation of a function call
     *
     * @returns Promise that resolves with function call's result
     */
    remote_procedure_call.prototype.call = function (call_string) {
        var _this = this;
        var _a = JSON.parse(call_string), action = _a[0], fname = _a[1], argument_array = _a[2];
        var args = this.deserialize_arguments(argument_array);
        // console.log(`\t\t\t* fname = '${fname}', argument_array=`, argument_array);
        if (action == 'call') {
            var m = fname.match(/(.+)\.(.+)/);
            if (m) {
                var instancename = m[1], methodname_1 = m[2];
                return Promise.resolve(this.instances[instancename].instance)
                    .then(function (instance) {
                    return instance[methodname_1].apply(instance, args);
                });
            }
            else {
                return this.get_function(fname).then(function (f) { return f.apply(void 0, args); });
            }
        }
        if (action == 'instantiate') {
            return this.get_function(fname)
                .then(function (f) {
                var instance = new (f.bind.apply(f, __spreadArrays([void 0], _this.deserialize_arguments(argument_array))))();
                var instance_id = helper_1.generate_id('xxxxxxxxxx', 36);
                _this.instances[instance_id] = { instance: instance };
                var result = {
                    instance_id: instance_id,
                    properties: []
                };
                var _loop_1 = function (name_1) {
                    var prop = instance[name_1];
                    var prop_wrapper = function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        return prop instanceof Function ? prop.apply(void 0, args) : prop;
                    };
                    var wrapper_id = helper_1.generate_id('xxxxxxxxxx', 36);
                    _this.register_function(wrapper_id, prop_wrapper);
                    result.properties.push({ name: name_1, wrapper_id: wrapper_id });
                };
                for (var name_1 in instance) {
                    _loop_1(name_1);
                }
                return result;
            });
        }
    };
    /**
     * instatiate a class registered on remote side
     *
     * @param {string} fname function name
     * @param  {...any} args arguments that shall be used while instantiating remote class
     *
     * @returns Promise that will be resolved after remote instatiation was successful
     *          with wrapper class that calls remote props
     */
    remote_procedure_call.prototype.instantiate_class = function (fname) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return this.sendfunction(JSON.stringify([
            'instantiate',
            fname,
            this.serialize_arguments(args)
        ]))
            .then(function (_a) {
            var instance_id = _a.instance_id, properties = _a.properties;
            return properties.reduce(function (obj, _a) {
                var name = _a.name, wrapper_id = _a.wrapper_id;
                obj[name] = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return _this.call_function.apply(_this, __spreadArrays([wrapper_id], args));
                };
                return obj;
            }, {});
        });
    };
    /**
     * wraps a function. When result gets called, local and remote function get called.
     *
     * @param {function} f
     * @param {string} fname
     *
     * @returns function that returns promise with results of local ad remote call.
     */
    remote_procedure_call.prototype.wrap_function = function (f, fname) {
        var _this = this;
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return Promise.all([
                Promise.resolve()
                    .then(function () { return f.apply(void 0, args); }),
                _this.call_function.apply(_this, __spreadArrays([fname], args))
            ]);
        };
    };
    return remote_procedure_call;
}());
exports.default = remote_procedure_call;
