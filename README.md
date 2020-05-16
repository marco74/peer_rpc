# Call Remote Procedures on other peer (or even a server)
## Installation
```sh
npm install peer-rpc --save
```

## Usage
First rpc must be initialized. Therefore import the class:
```javascript
import remote_procedure_call from 'peer_rpc';
```

Afterward we need to implement a send function. This is so generic that
every protocol may be used for that.

```javascript
let sendfunction = (msg) => {
	// Here's how to send message to other peer. This may be over
	// WebSocket, WebRTC, XMPP or every other transport protocol.
}
```

With this sendfunction we are able to instantiate the rpc-class on each peer:
```javascript
let rpc = remote_procedure_call(sendfunction);
```

Then we're able to register a function on one peer ...
```javascript
rpc.register_function('hello_peer', (peer_name) => {
	console.log(`Hello from ${peer_name}!`);
	return 'peer1';
});
```

... and call it on the other peer under the registered name
```javascript
rpc.call_function('hello_peer', 'peer2')
	.then((peer_name) => {
		console.log(`Hello from other peer: ${peer_name}`);
	});
```

this prints out

```Hello from peer2```

on the first peer and

```Hello from other peer: peer1```

on the second peer

As we can see, the result of a called function is returned via a Promise on the caller

## Callbacks
It's also possible to call callbacks.

Register function on one peer ...
```javascript
let ob2 = new observer();
rpc.register_function('function_with_callback', (fn) => {
	return fn(42)
		.then((r) => {
			assert(r=='fake');
			return 45;
		})
});
```

... and call it on the other side

```javascript
return rpc.call_function('function_with_callback', (v) => {
		assert(v == 42);
		return 'fake';
	})
	.then((res) => {
		assert(res == 45);
	})
```

## Wrap a function
Sometimes it happens that the same function has to be called on both peers. This can
be achieved by wrapping the function. The wrapped function returns a Promise that will
be resolved with both results as an array.

remote:
```javascript
rpc.register_function('foo', () => 42);
```

local:
```javascript
let wrapped = rpc.wrap_function(() => 43, 'foo');

wrapped('bar')
	.then(([local, remote]) => {
		assert(local == 42);
		assert(remote == 43);
	});
```

## Wrap a class
It's also possible to wrap whole classes. Since classes and function are very similar in
javascript we can register the class like a function

remote:
```javascript
function cls () {
	this.a = 3
	this.hello_remote = () => {
		return 'Hello Remote!';
	}
}
rpc.register_function('cls', cls);
```

local:
```javascript
rpc.instantiate_class('cls')
	.then((instance) => {
		instance.a()
			.then((res) => {
				assert(res == 3);
			})
		instance.hello_remote()
			.then(() => {
				assert(res == 'Hello Remote!');
			})
	});
```