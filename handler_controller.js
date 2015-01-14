function stop () {
	var handlers = this.handlers;
	for (var key in handlers) {
		handlers[key].stop();
	};
	//_.forIn(handlers, function (handler) {
	//	handler.stop();
	//});
};

HandlerController = function () {
	this.handlers = [];
};

HandlerController.prototype.set = function (name) {
	var oldHandler = this.handlers[name];
	if (oldHandler) oldHandler.stop();

	return this.handlers[name] = new cursorController();
};

HandlerController.prototype.stop = stop;

function cursorController () {
	this.handlers = [];
};

cursorController.prototype.add = function (handler) {
	this.handlers.push(handler);
	return handler;
};

cursorController.prototype.stop = stop;