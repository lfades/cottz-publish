CursorMethods = function (cursor, options) {
	this.cursor = cursor;
	for (var prop in options) {
		if(options.hasOwnProperty(prop))
			this[prop] = options[prop];
	}
};

_.extend(CursorMethods.prototype, {
	observe: function (callbacks) {
		return this.handler.add(this.cursor.observe(callbacks));
	},
	observeChanges: function (callbacks) {
		return this.handler.add(this.cursor.observeChanges(callbacks));
	},
	// adds a new cursor in a different collection to the main
	publish: function (callback) {
		var sub = this.sub;
		var collection = this.collection;

		if (callback) {
			var stop = publish.prototype.relations(sub, {
				cursor: this.cursor,
				name: collection
			}, callback);

			return this.handler.add(stop);
		} else {
			// basic cursor
			return this.observeChanges({
				added: function (id, doc) {
					sub.added(collection, id, doc);
				},
				changed: function (id, doc) {
					sub.changed(collection, id, doc);
				},
				removed: function (id) {
					sub.removed(collection, id);
				}
			});
		}
	},
	// designed to change something in the master document while the callbacks are executed
	// changes to the document are sent to the main document with the return of the callbacks
	changeParentDoc: function (callbacks, onRemoved) {
		var sub = this.sub,
			_id = this._id,
			collection = this.parentCollection,
			result = {};
		
		if (typeof callbacks == 'function') {
			callbacks = {
				added: callbacks,
				changed: callbacks,
				removed: onRemoved
			}
		}

		this.observeChanges({
			added: function (id, doc) {
				result = callbacks.added && callbacks.added(id, doc);
			},
			changed: function (id, doc) {
				var changes = callbacks.changed && callbacks.changed(id, doc);
				if(changes)
					sub.changed(collection, _id, changes);
			},
			removed: function (id) {
				var changes = callbacks.removed && callbacks.removed(id);
				if(changes)
					sub.changed(collection, _id, changes);
			}
		});

		return result;
	},
	// I'm thinking of deleting this method, I do not find great usability
	group: function (make, field, options) {
		var sub = this.sub,
			_id = this._id,
			collection = this.parentCollection,
			result = [];

		if(options) {
			var sort = options.sort,
				sortField = options.sortField;
		}
		
		this.observe({
			addedAt: function (doc, atIndex) {
				if(sort) {
					atIndex = sort.indexOf(doc[sortField || '_id']);
					result[atIndex] = make(doc, atIndex);
				} else
					result.push(make(doc, atIndex));
			},
			changedAt: function (doc, oldDoc, atIndex) {
				if(sort)
					atIndex = sort.indexOf(doc[sortField || '_id']);

				var changes = make(doc, atIndex, oldDoc),
					changesObj = {};

				result[atIndex] = changes;
				changesObj[field] = result;

				console.log(collection, _id);
				sub.changed(collection, _id, changesObj);
			},
			removedAt: function (oldDoc, atIndex) {
				var cb = options.onRemoved;
				if(cb)
					sub.changed(collection, _id, cb(oldDoc, atIndex));
			}
		});

		return result;
	}
});