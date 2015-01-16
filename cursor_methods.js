CursorMethods = function (sub, handlers, parentId, collection) {
	this.sub = sub;
	this.userId = sub.userId;
	this.handler = handlers || new HandlerController();

	this._id = parentId;
	this.collection = collection;
};

CursorMethods.prototype.observe = function (cursor, callbacks) {
	this.handler.add(cursor.observe(callbacks), cursor._getCollectionName());
};

CursorMethods.prototype.observeChanges = function (cursor, callbacks) {
	this.handler.add(cursor.observeChanges(callbacks), cursor._getCollectionName());
};

CursorMethods.prototype.cursor = function (cursor, callbacks) {
	var sub = this.sub;

	var name = cursor._getCollectionName();
	this.handler.add(name);
	var handler = this.handler.handlers[name];

	if (!cursor)
		throw new Error("you're not sending the cursor");

	if (callbacks)
		callbacks = this._getCallbacks(callbacks);

	var observeChanges = cursor.observeChanges({
		added: function (id, doc) {
			if (name == 'cards')
				console.log('card added _id: ', id);
			
			if (callbacks) {
				callbacks.added.call(new CursorMethods(sub, handler.add(id), id, name), id, doc);
			}
			
			sub.added(name, id, doc);
		},
		changed: function (id, doc) {
			if (name == 'cards')
				console.log(doc);
			
			if (callbacks)
				callbacks.added.call(new CursorMethods(sub, handler.add(id), id, name), id, doc);

			sub.changed(name, id, doc);
		},
		removed: function (id) {
			if (name == 'cards')
				console.log('card removed _id: ', id);

			if (callbacks)
				callbacks.removed(id);

			sub.removed(name, id);
		}
	});

	return handler.set(observeChanges);
};

CursorMethods.prototype.changeParentDoc = function (cursor, callbacks, onRemoved) {
	var sub = this.sub,
		_id = this.parentId,
		collection = this.collection,
		result = {};
	
	callbacks = this._getCallbacks(callbacks, onRemoved);

	this.handlers.add(cursor.observeChanges({
		added: function (id, doc) {
			result = callbacks.added(id, doc);
		},
		changed: function (id, doc) {
			var changes = callbacks.changed(id, doc);
			if(changes)
				sub.changed(collection, _id, changes);
		},
		removed: function (id) {
			var changes = callbacks.removed(id);
			if(changes)
				sub.changed(collection, _id, changes);
		}
	}), cursor._getCollectionName());

	return result;
};

CursorMethods.prototype.group = function (cursor, callbacks, field, options) {
	var sub = this.sub,
		_id = this._id,
		collection = this.collection,
		result = [];

	if(options) {
		var sort = options.sort,
			sortField = options.sortField;
	}
	callbacks = this._getCallbacks(callbacks);
	
	this.handlers.add(cursor.observe({
		addedAt: function (doc, atIndex) {
			if(sort) {
				atIndex = sort.indexOf(doc[sortField || '_id']);
				result[atIndex] = callbacks.added(doc, atIndex);
			} else
				result.push(callbacks.added(doc, atIndex));
		},
		changedAt: function (doc, oldDoc, atIndex) {
			if(sort)
				atIndex = sort.indexOf(doc[sortField || '_id']);

			var changes = callbacks.changed(doc, atIndex, oldDoc),
				changesObj = {};

			result[atIndex] = changes;
			changesObj[field] = result;

			sub.changed(collection, _id, changesObj);
		},
		removedAt: function (oldDoc, atIndex) {
			var cb = callbacks.removed;
			if(cb)
				sub.changed(collection, _id, cb(oldDoc, atIndex));
		}
	}), cursor._getCollectionName());

	return result;
};

CursorMethods.prototype._getCallbacks = function (cb, onRemoved) {
	var callbacks;
	if (typeof cb == 'function') {
		callbacks = {
			added: cb,
			changed: cb,
			removed: onRemoved || function () {}
		};
	} else {
		var methods = ['added', 'changed', 'removed'];
		for (var i = 0; i < methods.length; i ++) {
			var methodName = methods[i]; 
			if (!callbacks[methodName]) callbacks[methodName] = function () {};
		}
	}

	return callbacks;
};