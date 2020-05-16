function generate_id (pattern:string, l:number=10):string {
	return pattern.split('')
		.reduce((current, next) => {
			if (next == 'x') {
				return current+(Math.floor(Math.random()*l)).toString(l)
			} else {
				return current+next;
			}
		}, '');
}

function create_promise_object ():any {
	interface promisedict {
		promise?:Promise<any>,
		resolve?:(resolve_value:any) => void,
		reject?:(reject_value:any) => void,
	};

	let obj:promisedict = {};
	obj.promise = new Promise((resolve, reject) => {
		obj.resolve = resolve;
		obj.reject = reject;
	});
	return obj;
}

export {
	generate_id,
	create_promise_object
}
