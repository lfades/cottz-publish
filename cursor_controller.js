function stop () {
	var handlers = this.handlers;
	for (var key in handlers) {
		handlers[key].stop();
	};
	//_.forIn(handlers, function (handler) {
	//	handler.stop();
	//});
};

CursorController = function () {
	this.handlers = [];
};

CursorController.prototype.set = function (name) {
	var oldHandler = this.handlers[name];
	if (oldHandler) oldHandler.stop();

	return this.handlers[name] = new handlerController();
};

CursorController.prototype.stop = stop;

function handlerController () {
	this.handlers = [];
};

handlerController.prototype.add = function (cursor, observeName, callbacks) {
	var handler = this.handlers[observeName];

	if (handler) {
		handler.callbacks.push(callbacks);
	} else {
		var self = this;
		callbacks = [callbacks];
		this.handlers[observeName] = {callbacks: callbacks};

		var observe = cursor[observeName]({
			added: function () {
				self.callbacksFor('added', observeName, arguments);
			},
			changed: function () {
				self.callbacksFor('changed', observeName, arguments);
			},
			removed: function () {
				self.callbacksFor('removed', observeName, arguments);
			}
		});
		observe.callbacks = callbacks;
		
		this.handlers[observeName] = observe;
		return observe;
	}
};

handlerController.prototype.callbacksFor = function (eventName, handlerName, args) {
	var callbacks = this.handlers[handlerName].callbacks;
	for (var i in callbacks) {
		var cbs = callbacks[i];
		cbs[eventName] && cbs[eventName].apply(this, args);
	}
};

handlerController.prototype.stop = stop;