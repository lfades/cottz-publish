RelationsMethods = function (_id, options) {
	var handlers = options.handlers;

	if(!options.started) {
		if(handlers[_id]) {
			console.log('there is already an observer with the id: ' + _id + ' in the cursorName: ' + cursorName);
		}

		handlers[_id] = new HandlerController(_id);
	}

	this._id = _id;
	this.handlers = handlers[_id];

	this.sub = options.sub;
	this.name = options.cursorName;
};

_.extend(RelationsMethods.prototype, {
	observe: function (cursor, callbacks) {
		this.handlers.add(cursor.observe(callbacks), cursor);
	},
	observeChanges: function (cursor, callbacks) {
		this.handlers.add(cursor.observeChanges(callbacks), cursor);
	},
	// make parameter is a callback
	// adds a new cursor in a different collection to the main
	cursor: function (cursor, cursorName, make) {
		var handlers = this.handlers,
			withoutMake = typeof cursorName == 'function';

		if(!cursorName || withoutMake) {
			if(withoutMake)
				make = cursorName;

			cursorName = cursor._cursorDescription.collectionName;
		}

		return handlers.add(publish.prototype.relations(this.sub, {cursor: cursor, name: cursorName}, make), cursorName);
	},
	// designed to change something in the master document while the callbacks are executed
	// changes to the document are sent to the main document with the return of the callbacks
	changeParentDoc: function (cursor, callbacks, onRemoved) {
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

		var observe = cursor.observeChanges({
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

		this.handlers.add(observe, cursor);
		return result;
	},
	// returns an array of elements with all documents in the cursor
	// when there is a change it will update the element change in the resulting array
	// and send it back to the collection
	group: function (cursor, make, field, options) {
		var sub = this.sub,
			_id = this._id,
			name = this.name,
			result = [];

		if(options) {
			var sort = options.sort,
				sortField = options.sortField;
		}
		
		var observe = cursor.observe({
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

		this.handlers.add(observe, cursor);
		return result;
	},
	// designed to paginate a list, works in conjunction with the methods
	// do not call back to the main callback, only the array is changed in the collection
	paginate: function (fieldData, limit, infinite) {
		var sub = this.sub,
			_id = this._id,
			name = this.name;
			
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
				sub.changed(name, data._id, fieldData);
			}
		});

		this.handlers.add(listener, field);
		return fieldData[field];
	}
});