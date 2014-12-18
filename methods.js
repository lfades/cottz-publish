Meteor.methods({
	changePagination: function (field, _id, skip) {
		// I want to know if this is reliable
		var crossbar = DDPServer._InvalidationCrossbar;
		crossbar.fire({connection: this.connection.id, field: field, _id: _id, skip: skip});
	}
});