import { assert } from 'chai';
import remote_procedure_call from '../src/rpc';
import observer from 'ts-test-functions';

describe("rpc", () => {
	let rpc1:remote_procedure_call;
	let rpc2:remote_procedure_call;

	beforeEach(() => {
		rpc1 = new remote_procedure_call((arg:string) => {
			return Promise.resolve()
				.then(() => new Promise((resolve) => {
					setTimeout(resolve, 5);
				}))
				.then(() => rpc2.call(arg));
		});
		rpc2 = new remote_procedure_call((arg:string) => {
			return Promise.resolve()
				.then(() => new Promise((resolve) => {
					setTimeout(resolve, 2);
				}))
				.then(() => rpc1.call(arg));
		});
	});
	describe("call_function", () => {
		it('should simply call remote function', () => {
			let ob = new observer();
			rpc2.register_function('a', ob.fake(42));
			return rpc1.call_function('a', 1, 2, 3)
				.then((res) => {
					assert(ob.calledoncewith(1, 2, 3));
					assert(res == 42);
				})
		});

		it("should allow callbacks as arguments", () => {
			let ob2 = new observer();
			rpc2.register_function('b', (x:any, fn:Function) => {
				return fn(42)
					.then((r:any) => {
						assert(r=='fake');
						return 45;
					})
			});
			return rpc1.call_function('b', 23, ob2.fake('fake'))
				.then((res) => {
					assert(ob2.callcount() == 1);
					assert(res == 45);
				})
		});
		it("should wait until function gets registered on remote side", () => {
			let ob = new observer();
			let f = ob.fake();

			let p = rpc1.call_function('a', 1, 2, 3);
			assert(ob.callcount() == 0);
			rpc2.register_function('a', f);
			return p.then(() => {
				assert(ob.callcount() == 1);
				assert(ob.calledoncewith(1, 2, 3));
			});
		});
	});

	describe("wrap_function", () => {
		it ("should return promise resolved with the results of local and remote function", () => {
			let ob1 = new observer();
			let ob2 = new observer();

			let f1 = ob1.fake(42);
			let f2 = ob2.fake(43);

			rpc1.register_function('a', f1);
			let a = rpc2.wrap_function(f2, 'a');
			return a(1, 2, 3, 4)
				.then(([local, remote]) => {
					assert(ob1.calledoncewith(1, 2, 3, 4));
					assert(ob2.calledoncewith(1, 2, 3, 4));
					assert(local == 43);
					assert(remote == 42);
				});
		});
	});

	describe("instantiate_class", () => {
		class sum {
			public exec(a:number, b:number) {
				return a+b;
			}
			public type = 'sum';
		}
		class diff {
			public exec(a:number, b:number) {
				return a-b;
			}
			public type = 'diff';
		}
		
		/*
		let sum = function () {
			this.exec = (a, b) => a+b;
			this.type = 'sum';
		}

		let diff = function () {
			this.exec = (a, b) => a-b;
			this.type = 'diff';
		}
		*/
		beforeEach(() => {
			rpc1.register_function('sum', sum);
			rpc1.register_function('diff', diff);
		});
		it("should return Promise returning an object including the classes properties as methods", () => {
			let p1 = rpc2.instantiate_class('sum');
			let p2 = rpc2.instantiate_class('diff');
			assert(p1 instanceof Promise);
			assert(p2 instanceof Promise);
			return Promise.all([p1, p2])
				.then(([sum_obj, diff_obj]) => {
					assert(sum_obj instanceof Object)
					for (let propname in sum) {
						assert(propname in sum_obj);
						assert(sum_obj[propname] instanceof Function);
					}
					assert(diff_obj instanceof Object)
					for (let propname in diff) {
						assert(propname in diff_obj);
						assert(diff_obj[propname] instanceof Function);
					}
					return Promise.all([
						sum_obj.exec(2, 1),
						sum_obj.type(),
						diff_obj.exec(2, 1),
						diff_obj.type(),
					])
				})
				.then(([sum_result, sum_type, diff_result, diff_type]) => {
					assert(sum_result == 3);
					assert(sum_type == 'sum');
					assert(diff_result == 1);
					assert(diff_type == 'diff');
				});
		});
	});
});
