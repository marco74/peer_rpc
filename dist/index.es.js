function generate_id(pattern, l = 10) {
    return pattern.split('')
        .reduce((current, next) => {
        if (next == 'x') {
            return current + (Math.floor(Math.random() * l)).toString(l);
        }
        else {
            return current + next;
        }
    }, '');
}

class eventemitter {
    constructor() {
        this.callbacks = {};
    }
    on(eventname, f) {
        this.callbacks[eventname] = this.callbacks[eventname] || [];
        this.callbacks[eventname].push(f);
    }
    off(eventname, f) {
        this.callbacks[eventname] = this.callbacks[eventname] || [];
        this.callbacks[eventname].filter(fn => fn != f);
    }
    emit(eventname, ...args) {
        for (let f of this.callbacks[eventname] || []) {
            f(...args);
        }
    }
}

class remote_procedure_call extends eventemitter {
    constructor(send_function) {
        super();
        this.function_register = {};
        this.instances = {};
        this.sendfunction = send_function;
    }
    /**
     * get the registered function
     *
     * @param {string} fname String under which function is registered
     */
    get_function(fname) {
        if (fname in this.function_register) {
            //function already registered
            return Promise.resolve(this.function_register[fname]);
        }
        else {
            //function not registered yet => wait for it
            return new Promise((resolve) => {
                let eventhandler = (name, f) => {
                    if (name == fname) {
                        this.off('register_function', eventhandler);
                        resolve(f);
                    }
                };
                this.on('register_function', eventhandler);
            });
        }
    }
    /**
     * serializes argument_list for use in remote call. All arguments get replaced by object
     * representing the argument with type and value. Function are registered with an
     * internal id that replace the value.
     *
     * @param {Array} argument_list argument list to serialize
     */
    serialize_arguments(argument_list) {
        return argument_list.map((value) => {
            let result = {
                type: typeof value,
                value
            };
            if (value instanceof Function) {
                result.value = generate_id('xxxxxxxxxx', 36);
                this.register_function(result.value, value);
            }
            return result;
        });
    }
    /**
     * deserializes arguments from a call_string
     *
     * @param {Array} argument_array Array of arguments
     *
     * @returns deserialized arguments
     */
    deserialize_arguments(argument_array) {
        return argument_array
            .map(({ type, value }) => {
            if (type == 'function') {
                return (...args) => {
                    return this.sendfunction(JSON.stringify([
                        'call',
                        value,
                        this.serialize_arguments(args)
                    ]));
                };
            }
            return value;
        });
    }
    /**
     * Register a function or a class for remote call.
     *
     * @param {string} fname name under which the function shall be registered
     * @param {Function} f function that shall be registered
     */
    register_function(fname, f) {
        if ((typeof f == 'undefined') && fname instanceof Function) {
            f = fname;
            fname = f.name;
        }
        this.function_register[fname] = f;
        super.emit("register_function", fname, f);
    }
    ;
    /**
     * Register a function or a class for remote call.
     *
     * @param {string} fname name under which the function shall be registered
     * @param {Function} f function that shall be registered
     */
    unregister_function(fname, f) {
        if (this.function_register[fname] && this.function_register[fname] == f) {
            delete this.function_register[fname];
            super.emit("unregister_function", fname, f);
        }
    }
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
    call_function(fname, ...args) {
        return this.sendfunction(JSON.stringify([
            'call',
            fname,
            this.serialize_arguments(args)
        ]));
    }
    /**
     * deserializes function call string and executes function or instantiates class
     *
     * @param {string} call_string this is the serialized representation of a function call
     *
     * @returns Promise that resolves with function call's result
     */
    call(call_string) {
        let [action, fname, argument_array] = JSON.parse(call_string);
        let args = this.deserialize_arguments(argument_array);
        if (action == 'call') {
            let m = fname.match(/(.+)\.(.+)/);
            if (m) {
                let [, instancename, methodname] = m;
                return Promise.resolve(this.instances[instancename].instance)
                    .then((instance) => {
                    return instance[methodname](...args);
                });
            }
            else {
                return this.get_function(fname).then(f => f(...args));
            }
        }
        if (action == 'instantiate') {
            return this.get_function(fname)
                .then((f) => {
                let instance = new f(...this.deserialize_arguments(argument_array));
                let instance_id = generate_id('xxxxxxxxxx', 36);
                this.instances[instance_id] = { instance };
                let result = {
                    instance_id,
                    properties: []
                };
                let prop_handler = (name) => {
                    let prop = instance[name];
                    let prop_wrapper = (...args) => prop instanceof Function ? prop(...args) : prop;
                    let wrapper_id = generate_id('xxxxxxxxxx', 36);
                    this.register_function(wrapper_id, prop_wrapper);
                    result.properties.push({ name, wrapper_id });
                };
                Object.keys(instance)
                    .forEach(prop_handler);
                Object.getOwnPropertyNames(f.prototype)
                    .forEach((name) => {
                    if (name != 'constructor') {
                        prop_handler(name);
                    }
                });
                return result;
            });
        }
    }
    /**
     * instatiate a class registered on remote side
     *
     * @param {string} fname function name
     * @param  {...any} args arguments that shall be used while instantiating remote class
     *
     * @returns Promise that will be resolved after remote instatiation was successful
     *          with wrapper class that calls remote props
     */
    instantiate_class(fname, ...args) {
        return this.sendfunction(JSON.stringify([
            'instantiate',
            fname,
            this.serialize_arguments(args)
        ]))
            .then(({ properties }) => {
            return properties.reduce((obj, { name, wrapper_id }) => {
                obj[name] = (...args) => {
                    return this.call_function(wrapper_id, ...args);
                };
                return obj;
            }, {});
        });
    }
    /**
     * wraps a function. When result gets called, local and remote function get called.
     *
     * @param {function} f
     * @param {string} fname
     *
     * @returns function that returns promise with results of local ad remote call.
     */
    wrap_function(f, fname) {
        return (...args) => {
            return Promise.all([
                Promise.resolve()
                    .then(() => f(...args)),
                this.call_function(fname, ...args)
            ]);
        };
    }
}

export default remote_procedure_call;
