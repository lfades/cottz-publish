CursorMethods = function (cursor, query, options) {
	this.cursor = cursor;

	this._id = options._id;
	this.handlers = options.handlers;
	
	this.sub = options.sub;
	this.name = options.cursorName;
};

_.extend(CursorMethods.prototype, {
	observe: function (callbacks) {
		this.handlers.add(this.cursor.observe(callbacks));
	},
	observeChanges: function (cursor, callbacks) {
		this.handlers.add(this.cursor.observeChanges(callbacks));
	},
	// adds a new cursor in a different collection to the main
	publish: function (cursorName, callback) {
		var withoutCallback = typeof cursorName == 'function';

		if(!cursorName || withoutCallback) {
			if(withoutCallback)
				callback = cursorName;

			cursorName = this.name;
		}

		return this.handlers.add(publish.prototype.relations(this.sub, {cursor: this.cursor, name: cursorName}, callback));
	},
	// designed to change something in the master document while the callbacks are executed
	// changes to the document are sent to the main document with the return of the callbacks
	changeParentDoc: function (callbacks, onRemoved) {
		var sub = this.sub,
			_id = this._id,
			name = this.name,
			result = {};
		
		if(typeof callbacks == 'function') {
			callbacks = {
				added: callbacks,
				changed: callbacks,
				removed: onRemoved
			}
		}

		var observe = this.cursor.observeChanges({
			added: function (id, doc) {
				result = callbacks.added(id, doc);
			},
			changed: function (id, doc) {
				var changes = callbacks.changed(id, doc);
				if(changes)
					sub.changed(name, _id, changes);
			},
			removed: function (id) {
				var changes = callbacks.removed(id);
				if(changes)
					sub.changed(name, _id, changes);
			}
		});

		this.handlers.add(observe);
		return result;
	},
	group: function (make, field, options) {
		var sub = this.sub,
			_id = this._id,
			name = this.name,
			result = [];

		if(options) {
			var sort = options.sort,
				sortField = options.sortField;
		}
		
		var observe = this.cursor.observe({
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

				sub.changed(name, _id, changesObj);
			},
			removedAt: function (oldDoc, atIndex) {
				var cb = options.onRemoved;
				if(cb)
					sub.changed(name, _id, cb(oldDoc, atIndex));
			}
		});

		this.handlers.add(observe);
		return result;
	}
});