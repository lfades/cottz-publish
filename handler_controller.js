HandlerController = function () {
	this.handlers = [];
};

HandlerController.prototype.set = function (observe) {
	this.handler = observe;
};

HandlerController.prototype.add = function (name) {
	var oldHandler = this.handlers[name];
	if (oldHandler)
		oldHandler.stop();

	return this.handlers[name] = new HandlerController();
};

HandlerController.prototype.stop = function (handler, name) {
	var handlers = this.handlers;

	this.handler && this.handler.stop();

	for (var key in handlers) {
		handlers[key].stop();
	};

	this.handlers = [];
};