'use strict';

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
        this.callbacks = this.callbacks || {};
        this.callbacks[eventname] = this.callbacks[eventname] || [];
        this.callbacks[eventname].push(f);
    }
    off(eventname, f) {
        this.callbacks = this.callbacks || {};
        this.callbacks[eventname] = this.callbacks[eventname] || [];
        this.callbacks[eventname].filter(fn => fn != f);
    }
    emit(eventname, ...args) {
        this.callbacks = this.callbacks || {};
        for (let f of this.callbacks[eventname] || []) {
            f(...args);
        }
    }
}

class promise_register {
    constructor() {
        this.promises = {};
    }
    /**
     * resolve the registered promise specified by an id
     *
     * @param id id of the promise to resolve
     * @param args arguments to resolve with
     */
    resolve(id, ...args) {
        if (id in this.promises) {
            this.promises[id].resolve(...args);
        }
        else {
            throw new Error(`promise ${id} not found`);
        }
    }
    /**
     * reject the registered promise specified by an id
     *
     * @param id id of the promise to reject
     * @param args arguments to reject with
     */
    reject(id, ...args) {
        if (id in this.promises) {
            this.promises[id].reject(...args);
        }
        else {
            throw new Error(`promise ${id} not found`);
        }
    }
    /**
     * reject all promises
     *
     * @param args arguments to reject with
     */
    reject_all(...reason) {
        Object.values(this.promises)
            .forEach(({ reject }) => reject(...reason));
    }
    /**
     * create a new promise under the specified id
     * @param id id of the new promise
     *
     * @returns the new promise
     */
    new_promise(id) {
        if (id in this.promises) {
            throw new Error(`id '${id}' already used`);
        }
        this.promises[id] = {
            promise: new Promise(() => { }),
            resolve: () => { },
            reject: () => { }
        };
        this.promises[id].promise = new Promise((resolve, reject) => {
            this.promises[id].resolve = resolve;
            this.promises[id].reject = reject;
        });
        return this.promises[id].promise;
    }
}

class remote_procedure_call extends eventemitter {
    constructor(send_function, mystr) {
        super();
        this.function_register = {};
        this.instances = {};
        this.calls = new promise_register();
        this.sendfunction = send_function;
        this.mystr = mystr || '';
    }
    toString() {
        return this.mystr;
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
                //wrapper function that calls original function remotely:
                return (...args) => {
                    return Promise.resolve()
                        .then(() => this.call_function(value, ...args));
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
        this.function_register = this.function_register || {};
        this.function_register[fname] = f;
        super.emit("register_function", fname, f);
        this.sendfunction(JSON.stringify([
            'registered',
            null,
            null,
            this.serialize_arguments([fname])
        ]));
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
        this.sendfunction(JSON.stringify([
            'unregistered',
            null,
            null,
            this.serialize_arguments([fname])
        ]));
    }
    ;
    /**
     * Unregisteres all functions
     */
    unregister_all() {
        for (let fname in this.function_register) {
            this.unregister_function(fname, this.function_register[fname]);
        }
    }
    remote_call(action, fname, ...args) {
        let call_id = generate_id('xxxxxxxxxx', 36);
        let result = this.calls.new_promise(call_id);
        this.sendfunction(JSON.stringify([
            action,
            call_id,
            fname,
            this.serialize_arguments(args)
        ]));
        return result;
    }
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
        return this.remote_call('call', fname, ...args);
    }
    /**
     * deserializes function call string and executes function or instantiates class
     *
     * @param {string} call_string this is the serialized representation of a function call
     *
     * @returns Promise that resolves with function call's result
     */
    call(call_string) {
        let function_call = JSON.parse(call_string);
        let [action] = function_call.splice(0, 1);
        let params = this.deserialize_arguments(function_call.pop());
        let [call_id, fname] = function_call;
        let acknowledge = (result_type, result) => {
            if (action == 'call' || action == 'instantiate') {
                return this.sendfunction(JSON.stringify([
                    result_type,
                    call_id,
                    fname,
                    this.serialize_arguments([result])
                ]));
            }
        };
        return Promise.resolve()
            .then(() => {
            switch (action) {
                case 'call':
                    return this.get_function(fname)
                        .then((f) => f(...params));
                case 'instantiate':
                    return this.get_function(fname)
                        .then((f) => {
                        let instance = new f(...params);
                        let instance_id = generate_id('xxxxxxxxxx', 36);
                        this.instances[instance_id] = { instance };
                        let result = {
                            instance_id: '',
                            properties: []
                        };
                        let prop_handler = (name) => {
                            let prop = instance[name];
                            let prop_wrapper = (...args) => prop instanceof Function ?
                                prop.call(instance, ...args) :
                                prop;
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
                        this.emit('instantiate', instance, instance_id);
                        return result;
                    });
                case 'resolve':
                    return this.calls.resolve(call_id, ...params);
                case 'reject':
                    return this.calls.reject(call_id, ...params);
                case 'registered':
                    super.emit('remote_registered_function', params[0]);
                    return Promise.resolve();
                case 'unregistered':
                    super.emit('remote_unregistered_function', params[0]);
                    return Promise.resolve();
            }
        })
            .then((result) => acknowledge('resolve', result), (result) => acknowledge('reject', result));
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
        return this.remote_call('instantiate', fname, ...args)
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
    /**
     * rejects all function calls
     *
     * @param reason reason why to reject all
     */
    reject_all(reason) {
        this.calls.reject_all(reason);
    }
}

module.exports = remote_procedure_call;
