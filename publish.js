publish = function () {};

publish.prototype.cursor = function (cursor, sub, collectionName) {
	if(!collectionName)
		collectionName = cursor._cursorDescription.collectionName;
	Meteor.Collection._publishCursor(cursor, sub, collectionName);
};

publish.prototype.observe = function (cursor, callbacks, sub) {
	var observeHandle = cursor.observe(callbacks);

	sub && sub.onStop(function () {
		observeHandle.stop();
	});

	return observeHandle;
};

publish.prototype.observeChanges = function (cursor, callbacks, sub) {
	var observeHandle = cursor.observeChanges(callbacks);

	sub && sub.onStop(function () {
		observeHandle.stop();
	});

	return observeHandle;
};

Publish = new publish();