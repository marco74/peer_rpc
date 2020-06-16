import {generate_id} from './helper';
import eventemmitter from './ee'
import promise_register from './promise_register';
import {genericfunction} from './ee';

type argument_type = {
	type:string,
	value:any,
}

type dict = {
	[key:string]:any
}

class remote_procedure_call extends eventemmitter {
	private mystr:string;
	constructor (send_function:Function, mystr?:string) {
		super();
		this.sendfunction = send_function
		this.mystr = mystr || '';
	}
	toString() {
		return this.mystr;
	}

	private function_register: {
		[fname:string]: genericfunction
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
			if (value instanceof Error) {
				result.type = 'Error';
				result.value = {
					stack:value.stack,
					message:value.message,
					name:value.name
				};
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
					//wrapper function that calls original function remotely:
					return (...args: any[]) => {
						return Promise.resolve()
							.then(() => this.call_function(value,...args));
					};
				}
				if (type == 'Error') {
					let e = new Error();
					e.name = value.name;
					e.message = value.message;
					e.stack = value.stack;
					return e;
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
		this.function_register = this.function_register || {};
		this.function_register[fname] = f;
		super.emit("register_function", fname, f);
		this.sendfunction(JSON.stringify([
			'registered',
			null,
			null,
			this.serialize_arguments([fname])
		]));
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
		this.sendfunction(JSON.stringify([
			'unregistered',
			null,
			null,
			this.serialize_arguments([fname])
		]));
	};
	
	/**
	 * Unregisteres all functions
	 */
	public unregister_all():void {
		for (let fname in this.function_register) {
			this.unregister_function(fname, this.function_register[fname]);
		}
	}

	private calls = new promise_register();

	private remote_call(action:string, fname:string, ...args:any[]):Promise<any> {
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
	public call_function (fname:string, ...args:any[]):Promise<any> {
		return this.remote_call('call', fname, ...args);
	}

	/**
	 * deserializes function call string and executes function or instantiates class
	 * 
	 * @param {string} call_string this is the serialized representation of a function call
	 * 
	 * @returns Promise that resolves with function call's result
	 */
	public call (call_string:string) {
		let function_call = JSON.parse(call_string);
		let [action] = function_call.splice(0,1);
		let params = this.deserialize_arguments(function_call.pop());
		let [call_id, fname] = function_call;

		let acknowledge = (result_type:string, result:any) => {
			if (action == 'call' || action == 'instantiate') {
				return this.sendfunction(JSON.stringify([
					result_type,
					call_id,
					fname,
					this.serialize_arguments([result])
				]));
			}
		}

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
								
								let result:{instance_id:string,properties:any[]} = {
									instance_id:'',
									properties:[]
								};
		
								let prop_handler = (name:string) => {
									let prop = instance[name];
									let prop_wrapper = (...args:any[]) => prop instanceof Function ?
										prop.call(instance, ...args) :
										prop;
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
			.then(
				(result:any) => acknowledge('resolve', result),
				(result:any) => acknowledge('reject', result)
			)
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
		return this.remote_call('instantiate', fname, ...args)
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

	/**
	 * rejects all function calls
	 * 
	 * @param reason reason why to reject all
	 */
	public reject_all(reason:any):void {
		this.calls.reject_all(reason);
	}
	
}

export default remote_procedure_call;
