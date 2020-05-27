import {genericfunction} from './ee';

export default class promise_register {
	private promises:{
		[key:string]: {
			promise:Promise<any>,
			resolve:genericfunction,
			reject:genericfunction
		}
	} = {};
	
	/**
	 * resolve the registered promise specified by an id
	 * 
	 * @param id id of the promise to resolve
	 * @param args arguments to resolve with
	 */
	public resolve(id:string, ...args:any[]):void {
		if (id in this.promises) {
			this.promises[id].resolve(...args);
		} else {
			throw new Error(`promise ${id} not found`);
		}
	}

	/**
	 * reject the registered promise specified by an id
	 * 
	 * @param id id of the promise to reject
	 * @param args arguments to reject with
	 */
	public reject(id:string, ...args:any[]):void {
		if (id in this.promises) {
			this.promises[id].reject(...args);
		} else {
			throw new Error(`promise ${id} not found`);
		}	
	}

	/**
	 * reject all promises
	 * 
	 * @param args arguments to reject with
	 */
	public reject_all(...reason:any[]):void {
		Object.values(this.promises)
			.forEach(({reject}) => reject(...reason));
	}

	/**
	 * create a new promise under the specified id
	 * @param id id of the new promise
	 * 
	 * @returns the new promise
	 */
	public new_promise(id:string):Promise<any> {
		if (id in this.promises) {
			throw new Error(`id '${id}' already used`);
		}
		this.promises[id] = {
			promise: new Promise(() => {}),
			resolve: () => {},
			reject: () => {}
		};

		this.promises[id].promise = new Promise ((resolve, reject) => {
			this.promises[id].resolve = resolve;
			this.promises[id].reject = reject;
		});
		return this.promises[id].promise;
	}
}
