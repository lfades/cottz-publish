HandlerController = function (_id) {
	this._id = _id;
	this.handlers = [];
};

HandlerController.prototype.add = function (observe, cursorName) {
	if(typeof cursorName != 'string') {
		// in this case the cursor was sent instead of the cursor name
		cursorName = cursorName._cursorDescription.collectionName;
	}

	var oldHandler = this.handlers[cursorName];
	if(oldHandler)
		oldHandler.stop();

	this.handlers[cursorName] = observe;

	return observe;
};

HandlerController.prototype.stop = function () {
	var handlers = this.handlers;
	for (var key in handlers) {
		handlers[key].stop();
	};
	//_.forIn(handlers, function (handler) {
	//	handler.stop();
	//});
};