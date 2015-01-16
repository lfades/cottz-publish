Meteor.publishRelations = function (name, callback) {
	return Meteor.publish(name, function () {

		var cursors = new CursorMethods(this);
		callback.apply(cursors, arguments);

		this.onStop(function () {
			cursors.handler.stop();
		});

		return this.ready();
	});
};