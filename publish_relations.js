publish.prototype.relations = function (sub, options, callback) {
	var observes = [],
		cursor = options.cursor || options,
		name = options.name || cursor._cursorDescription.collectionName;

	if(!cursor)
		throw new Error("you're not sending the cursor");

	function _sendData (_id, parentDoc, addStarted) {
		if(callback) {
			var methods = new RelationsMethods(_id, {
				sub: sub,
				started: addStarted,
				cursorName: name,
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