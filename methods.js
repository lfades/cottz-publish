Meteor.methods({
	changePagination: function (field, inc) {
		// I want to know if this is reliable
		var crossbar = DDPServer._InvalidationCrossbar;
		crossbar.fire({connection: this.connection.id, field: field, inc: inc});
	}
});