Meteor.methods({
	changePagination: function (field, inc) {
		if(!this.userId)
			throw new Error("Invalid");
		// I want to know if this is reliable
		var crossbar = DDPServer._InvalidationCrossbar;
		crossbar.fire({userId: this.userId, field: field, inc: inc});
	}
});