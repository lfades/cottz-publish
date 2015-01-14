publish.prototype.relations = function (sub, options, callback) {
	var observes = [],
		cursor = options.cursor || options,
		name = options.name || cursor._cursorDescription.collectionName;

	if(!cursor)
		throw new Error("you're not sending the cursor");

	function _sendData (_id, parentDoc, addStarted) {
		if(callback) {
			var methods = new relationsMethods(_id, {
				sub: sub,
				started: addStarted,
				collection: name,
				handlers: observes
			});

			parentDoc = callback.call(methods, _id, parentDoc, addStarted) || parentDoc;
		}

		if(addStarted)
			sub.changed(name, _id, parentDoc);
		else
			sub.added(name, _id, parentDoc);
	};

	var cursorObserveChanges = cursor.observeChanges({
		added: function (id, doc) {
			_sendData(id, doc, false);
		},
		changed: function (id, doc) {
			// the true is indicate to the callback that the doc has changed
			_sendData(id, doc, true);
		},
		removed: function (id) {
			sub.removed(name, id);
			if(observes[id]) {
				observes[id].stop();
				delete observes[id];
			}
		}
	});

	function stopCursor () {
		cursorObserveChanges.stop();

		for (var key in observes) {
			observes[key].stop();
		};

		observes = [];
	};

	sub.onStop(stopCursor);
	// I do not think it necessary to send the Ready from here
	// return sub.ready();
	return {
		stop: stopCursor
	};
};

function relationsMethods (_id, options) {
	var handlers = options.handlers;

	if(!options.started) {
		if(handlers[_id]) {
			throw new Error('there is already an observer with the id: ' + _id + ' in the cursorName: ' + cursorName);
		}

		handlers[_id] = new HandlerController();
	}

	this._id = _id;
	this.handlers = handlers[_id];
	
	this.sub = options.sub;
	this.parentCollection = options.collection;
};

relationsMethods.prototype.cursor = function (cursor, collection) {
	if (!cursor)
		throw new Error("you're not sending the cursor");
	
	collection = collection || cursor._cursorDescription.collectionName;
	this.handler = this.handlers.set(collection);
	this.collection = collection;

	return new CursorMethods(cursor, this);
};
// designed to paginate a list, works in conjunction with the methods
// do not call back to the main callback, only the array is changed in the collection
relationsMethods.prototype.paginate = function (fieldData, limit, infinite) {
	var sub = this.sub,
		_id = this._id,
		collection = this.parentCollection,
		handlers = this.handlers.handlers;
		
	var crossbar = DDPServer._InvalidationCrossbar,
		field = Object.keys(fieldData)[0],
		copy = _.clone(fieldData)[field],
		max = copy.length,
		connectionId = sub.connection.id;

	fieldData[field] = copy.slice(0, limit);

	var listener = crossbar.listen({connection: connectionId, _id: _id, field: field}, function (data) {
		if(connectionId == data.connection) {
			var skip = data.skip;

			if(skip >= max && !infinite)
				return;

			fieldData[field] = infinite ? copy.slice(0, skip): copy.slice(skip, skip + limit);
			sub.changed(collection, data._id, fieldData);
		}
	});

	var handler = handlers[field];
	if(handler)
		handler.stop();

	handlers[field] = listener;
	return fieldData[field];
};