HandlerController = function (_id) {
	this._id = _id;
	this.handlers = [];
};

HandlerController.prototype.setHandler = function (cursorName, query) {
	this.name = cursorName;
	this.query = query;
};

HandlerController.prototype.add = function (observe, cursorName) {
	cursorName = cursorName || this.name;
	observe.query = this.query;

	var oldHandler = this.handlers[cursorName];
	if(oldHandler && _.isEqual(oldHandler.query, this.query))
		oldHandler.stop();

	this.handlers[cursorName] = observe;

	return observe;
};

HandlerController.prototype.stop = function () {
	var handlers = this.handlers;
	for (var key in handlers) {
		console.log(key, ' ---');
		handlers[key].stop();
	};
	//_.forIn(handlers, function (handler) {
	//	handler.stop();
	//});
};