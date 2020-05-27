import eventemmitter from './ee';
declare class remote_procedure_call extends eventemmitter {
    constructor(send_function: Function);
    private function_register;
    private instances;
    private sendfunction;
    /**
     * get the registered function
     *
     * @param {string} fname String under which function is registered
     */
    private get_function;
    /**
     * serializes argument_list for use in remote call. All arguments get replaced by object
     * representing the argument with type and value. Function are registered with an
     * internal id that replace the value.
     *
     * @param {Array} argument_list argument list to serialize
     */
    private serialize_arguments;
    /**
     * deserializes arguments from a call_string
     *
     * @param {Array} argument_array Array of arguments
     *
     * @returns deserialized arguments
     */
    private deserialize_arguments;
    /**
     * Register a function or a class for remote call.
     *
     * @param {string} fname name under which the function shall be registered
     * @param {Function} f function that shall be registered
     */
    register_function(fname: any, f: any): void;
    /**
     * Register a function or a class for remote call.
     *
     * @param {string} fname name under which the function shall be registered
     * @param {Function} f function that shall be registered
     */
    unregister_function(fname: any, f: any): void;
    /**
     * Unregisteres all functions
     */
    unregister_all(): void;
    private calls;
    private remote_call;
    /**
     * Call a function on remote side. The function call is serialized and
     * the registered send function invoked.
     *
     * @param {string} fname string under which function was registered
     * @param  {...any} args arguments for the function call
     *
     * @returns result of the sendfunction
     */
    call_function(fname: string, ...args: any[]): Promise<any>;
    /**
     * deserializes function call string and executes function or instantiates class
     *
     * @param {string} call_string this is the serialized representation of a function call
     *
     * @returns Promise that resolves with function call's result
     */
    call(call_string: string): Promise<any>;
    /**
     * instatiate a class registered on remote side
     *
     * @param {string} fname function name
     * @param  {...any} args arguments that shall be used while instantiating remote class
     *
     * @returns Promise that will be resolved after remote instatiation was successful
     *          with wrapper class that calls remote props
     */
    instantiate_class(fname: string, ...args: any[]): Promise<any>;
    /**
     * wraps a function. When result gets called, local and remote function get called.
     *
     * @param {function} f
     * @param {string} fname
     *
     * @returns function that returns promise with results of local ad remote call.
     */
    wrap_function(f: Function, fname: string): (...args: any[]) => Promise<[any, any]>;
    /**
     * rejects all function calls
     *
     * @param reason reason why to reject all
     */
    reject_all(reason: any): void;
}
export default remote_procedure_call;
