export type genericfunction = (...args: any[]) => void | any;
type functionarraydict = { [callbackname:string]:genericfunction[] };
export default class eventemitter {
	private callbacks: functionarraydict = {};
	public on(eventname:string, f:genericfunction): void {
		this.callbacks = this.callbacks || {};
		this.callbacks[eventname] = this.callbacks[eventname] || [];
		this.callbacks[eventname].push(f);
	}
	public off(eventname:string, f:genericfunction): void {
		this.callbacks = this.callbacks || {};
		this.callbacks[eventname] = this.callbacks[eventname] || [];
		this.callbacks[eventname].filter(fn => fn != f);
	}
	public emit(eventname:string, ...args:any[]): void {
		this.callbacks = this.callbacks || {};
		for (let f of this.callbacks[eventname] || []) {
			f(...args);
		}
	}
};