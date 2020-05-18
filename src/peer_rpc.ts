import {generate_id} from './helper';
import eventemmitter from './ee'
import {genericfunction} from './ee';

type argument_type = {
	type:string,
	value:any
}

class remote_procedure_call extends eventemmitter {
	constructor (send_function:Function) {
		super();
		this.sendfunction = send_function
	}
	private function_register:{
		[fname:string]:{
			promise:any;
			resolve:Function;
		}
	} = {};
	private instances:{
		[instance_id:string]:{
			instance:any;
		}
	} = {};
	private sendfunction:Function;

	/**
	 * get the registered function
	 * 
	 * @param {string} fname String under which function is registered
	 */
	private get_function (fname:string):Promise<any> {
		if (fname in this.function_register) {

			//function already registered
			return Promise.resolve(this.function_register[fname]);
		
		} else {
		
			//function not registered yet => wait for it
			return new Promise((resolve) => {
				let eventhandler = (name:string, f:genericfunction) => {
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
	private serialize_arguments (argument_list:object[]):argument_type[] {
		return argument_list.map((value) => {
			let result:argument_type = {
				type:typeof value,
				value
			};
			if (value instanceof Function) {
				result.value = generate_id('xxxxxxxxxx', 36);
				this.register_function (result.value, value);
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
	private deserialize_arguments (argument_array:any[]):any[] {
		return argument_array
			.map(({type, value}) => {
				if (type == 'function') {
					return (...args: any[]) => { //wrapper function that calls original function remotely
						return this.sendfunction(JSON.stringify([
							'call',
							value,
							this.serialize_arguments(args)
						]));
					}
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
	public register_function (fname:any, f:any):void {
		if ((typeof f == 'undefined') && fname instanceof Function) {
			f = fname;
			fname = f.name;
		}
		this.function_register[fname] = f;
		super.emit("register_function", fname, f);
	};

	/**
	 * Register a function or a class for remote call.
	 * 
	 * @param {string} fname name under which the function shall be registered
	 * @param {Function} f function that shall be registered
	 */
	public unregister_function (fname:any, f:any):void {
		if (this.function_register[fname] && this.function_register[fname] == f) {
			delete this.function_register[fname];
			super.emit("unregister_function", fname, f);
		}
	};
	
	/**
	 * Unregisteres all functions
	 */
	public unregister_all():void {
		for (let fname in this.function_register) {
			this.unregister_function(fname, this.function_register[fname]);
		}
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
	public call_function (fname:string, ...args:any[]):Promise<any> {
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
	public call (call_string:string) {
		let [action, fname, argument_array] = JSON.parse(call_string);
		let args = this.deserialize_arguments(argument_array);
		if (action == 'call') {
			let m:[string, string, string] = fname.match(/(.+)\.(.+)/);
			if (m) {
				let [,instancename, methodname] = m;
				return Promise.resolve(this.instances[instancename].instance)
					.then((instance) => {
						return instance[methodname](...args);
					});
			} else {
				return this.get_function(fname).then(f => f(...args));
			}
		}
		if (action == 'instantiate') {
			return this.get_function(fname)
				.then((f) => {
					let instance = new f(...this.deserialize_arguments(argument_array));
					let instance_id = generate_id('xxxxxxxxxx', 36);
					this.instances[instance_id] = { instance };
					
					let result:{instance_id:string,properties:any[]} = {
						instance_id,
						properties:[]
					};

					let prop_handler = (name:string) => {
						let prop = instance[name];
						let prop_wrapper = (...args:any[]) => prop instanceof Function ? prop(...args) : prop;
						let wrapper_id = generate_id('xxxxxxxxxx', 36);
						this.register_function(wrapper_id, prop_wrapper);
						result.properties.push({name, wrapper_id});
					}

					Object.keys(instance)
						.forEach(prop_handler);
					Object.getOwnPropertyNames(f.prototype)
						.forEach((name:string) => {
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
	public instantiate_class (fname:string, ...args:any[]) {
		return this.sendfunction(JSON.stringify([
			'instantiate',
			fname,
			this.serialize_arguments(args)
		]))
			.then(({properties}:{properties:any[]}) => {
				return properties.reduce((obj:any, {name, wrapper_id}:{name:string; wrapper_id:string}) => {
					obj[name] = (...args:any[]) => {
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
	public wrap_function (f:Function, fname:string) {
		return (...args: any[]) => {
			return Promise.all([
				Promise.resolve()
					.then(() => f(...args)),
				this.call_function(fname, ...args)
			]);
		}
	}
	
}

export default remote_procedure_call;
