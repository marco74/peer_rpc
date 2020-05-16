"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var peer_rpc_1 = require("../src/peer_rpc");
var ts_test_functions_1 = require("ts-test-functions");
describe("rpc", function () {
    var rpc1;
    var rpc2;
    beforeEach(function () {
        rpc1 = new peer_rpc_1.default(function (arg) {
            return Promise.resolve()
                .then(function () { return new Promise(function (resolve) {
                setTimeout(resolve, 5);
            }); })
                .then(function () { return rpc2.call(arg); });
        });
        rpc2 = new peer_rpc_1.default(function (arg) {
            return Promise.resolve()
                .then(function () { return new Promise(function (resolve) {
                setTimeout(resolve, 2);
            }); })
                .then(function () { return rpc1.call(arg); });
        });
    });
    describe("call_function", function () {
        it('should simply call remote function', function () {
            var ob = new ts_test_functions_1.default();
            rpc2.register_function('a', ob.fake(42));
            return rpc1.call_function('a', 1, 2, 3)
                .then(function (res) {
                chai_1.assert(ob.calledoncewith(1, 2, 3));
                chai_1.assert(res == 42);
            });
        });
        it("should allow callbacks as arguments", function () {
            var ob2 = new ts_test_functions_1.default();
            rpc2.register_function('b', function (x, fn) {
                return fn(42)
                    .then(function (r) {
                    chai_1.assert(r == 'fake');
                    return 45;
                });
            });
            return rpc1.call_function('b', 23, ob2.fake('fake'))
                .then(function (res) {
                chai_1.assert(ob2.callcount() == 1);
                chai_1.assert(res == 45);
            });
        });
        it("should wait until function gets registered on remote side", function () {
            var ob = new ts_test_functions_1.default();
            var f = ob.fake();
            var p = rpc1.call_function('a', 1, 2, 3);
            chai_1.assert(ob.callcount() == 0);
            rpc2.register_function('a', f);
            return p.then(function () {
                chai_1.assert(ob.callcount() == 1);
                chai_1.assert(ob.calledoncewith(1, 2, 3));
            });
        });
    });
    describe("wrap_function", function () {
        it("should return promise resolved with the results of local and remote function", function () {
            var ob1 = new ts_test_functions_1.default();
            var ob2 = new ts_test_functions_1.default();
            var f1 = ob1.fake(42);
            var f2 = ob2.fake(43);
            rpc1.register_function('a', f1);
            var a = rpc2.wrap_function(f2, 'a');
            return a(1, 2, 3, 4)
                .then(function (_a) {
                var local = _a[0], remote = _a[1];
                chai_1.assert(ob1.calledoncewith(1, 2, 3, 4));
                chai_1.assert(ob2.calledoncewith(1, 2, 3, 4));
                chai_1.assert(local == 43);
                chai_1.assert(remote == 42);
            });
        });
    });
    describe("instantiate_class", function () {
        var sum = /** @class */ (function () {
            function sum() {
                this.type = 'sum';
            }
            sum.prototype.exec = function (a, b) {
                return a + b;
            };
            return sum;
        }());
        var diff = /** @class */ (function () {
            function diff() {
                this.type = 'diff';
            }
            diff.prototype.exec = function (a, b) {
                return a - b;
            };
            return diff;
        }());
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
        beforeEach(function () {
            rpc1.register_function('sum', sum);
            rpc1.register_function('diff', diff);
        });
        it("should return Promise returning an object including the classes properties as methods", function () {
            var p1 = rpc2.instantiate_class('sum');
            var p2 = rpc2.instantiate_class('diff');
            chai_1.assert(p1 instanceof Promise);
            chai_1.assert(p2 instanceof Promise);
            return Promise.all([p1, p2])
                .then(function (_a) {
                var sum_obj = _a[0], diff_obj = _a[1];
                chai_1.assert(sum_obj instanceof Object);
                for (var propname in sum) {
                    chai_1.assert(propname in sum_obj);
                    chai_1.assert(sum_obj[propname] instanceof Function);
                }
                chai_1.assert(diff_obj instanceof Object);
                for (var propname in diff) {
                    chai_1.assert(propname in diff_obj);
                    chai_1.assert(diff_obj[propname] instanceof Function);
                }
                return Promise.all([
                    sum_obj.exec(2, 1),
                    sum_obj.type(),
                    diff_obj.exec(2, 1),
                    diff_obj.type(),
                ]);
            })
                .then(function (_a) {
                var sum_result = _a[0], sum_type = _a[1], diff_result = _a[2], diff_type = _a[3];
                chai_1.assert(sum_result == 3);
                chai_1.assert(sum_type == 'sum');
                chai_1.assert(diff_result == 1);
                chai_1.assert(diff_type == 'diff');
            });
        });
    });
});
