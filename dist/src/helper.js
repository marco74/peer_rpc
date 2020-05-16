"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create_promise_object = exports.generate_id = void 0;
function generate_id(pattern, l) {
    if (l === void 0) { l = 10; }
    return pattern.split('')
        .reduce(function (current, next) {
        if (next == 'x') {
            return current + (Math.floor(Math.random() * l)).toString(l);
        }
        else {
            return current + next;
        }
    }, '');
}
exports.generate_id = generate_id;
function create_promise_object() {
    ;
    var obj = {};
    obj.promise = new Promise(function (resolve, reject) {
        obj.resolve = resolve;
        obj.reject = reject;
    });
    return obj;
}
exports.create_promise_object = create_promise_object;
