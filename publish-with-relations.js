publishCursor = function (cursor, sub, collectionName) {
	if(!collectionName)
		collectionName = cursor._cursorDescription.collectionName;
	Meteor.Collection._publishCursor(cursor, sub, collectionName);
};
/******************************************************************************************************
//// PUBLISH WITH RELATIONS \\\\
*******************************************************************************************************/
function stopObserves (docObserves) {
	for (var key in docObserves) {
		docObserves[key].stop();
	};
	//_.forIn(docObserves, function (observe) {
	//	observe.stop();
	//});
};

publishWithRelations = function (sub, options, callback) {
	var observes = [],
		cursor = options.cursor || options,
		name = options.name || cursor._cursorDescription.collectionName,
		addStarted = false,
		results = [],
		skip = 0;

	if(!cursor)
		throw new Error("you're not sending the cursor");

	function _add (_id, parentDoc) {
		var _add = {};
		
		if(addStarted) {
			stopObserves(observes[_id]);
			observes[_id] = [];
		} else if(!observes[_id])
			observes[_id] = [];

		// make parameter is a callback

		// adds a new cursor in a different collection to the main
		_add.cursor = function (cursor, cursorName, make) {
			if(!cursorName)
				cursorName = cursor._cursorDescription.collectionName;
			
			var observe = cursor.observeChanges({
				added: function (id, doc) {
					var cb = make ? make(id, doc): null;
					sub.added(cursorName, id, cb || doc);
				},
				changed: function (id, doc) {
					var cb = make ? make(id, doc): null;
					sub.changed(cursorName, id, cb || doc);
				},
				removed: function (id) {
					sub.removed(cursorName, id);
				}
			});

			observes[_id].push(observe);
		};

		// designed to change something in the master document while the 'make' is executed
		// changes to the document are sent to the main document with the return of the 'make'
		_add.changeParentDoc = function (cursor, make) {
			var result,
			observe = cursor.observe({
				added: function (doc) {
					result = make(doc);
				},
				changedAt: function (doc, oldDoc, atIndex) {
					var changes = make(doc, oldDoc, atIndex);
					if(changes)
						sub.changed(name, _id, changes);
				}
			});

			observes[_id].push(observe);
			return result;
		};

		// returns an array of elements with all documents in the cursor
		// when there is a change it will update the element change in the resulting array
		// and send it back to the collection
		_add.group = function (cursor, make, field, options) {
			var result = [];
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

			observes[_id].push(observe);
			return result;
		};

		// reactively change a field in the main document
		// is designed to handle only 1 document
		// returns the document found in the cursor, if the document _id is equal to a previous
		// query (query assumes that is the _id) returns the document from the previous query 
		// again without performing the same query and when a change will update everyone calling parameter onChanged
		_add.field = function (cursor, query, onChanged) {
			var result = results[query];
			if(result) {
				result._id.push(_id);
				return result;
			}

			var observe = {
				added: function (doc) {
					doc._id = [_id];
					results[query] = doc;
				}
			};

			if(onChanged) {
				function changeDoc (doc, oldDoc) {
					for (var docId in results) {
						if(docId == doc._id) {
							var changes = onChanged(doc, oldDoc),
								_ids = results[docId]._id;

							for (var _id in _ids)
								sub.changed(name, _ids[_id], changes);

							doc._id = _ids
							results[docId] = doc;

							break;
						}
					}
				};

				observe.changed = changeDoc;
				observe.removed = changeDoc;
			}

			observes[_id].push(cursor.observe(observe));

			result = _.clone(results[query]);
			result._id = query;
			return result;
		};
		
		// designed to paginate a list, works in conjunction with the methods
		// do not call back to the main callback, only the array is changed in the collection
		_add.paginate = function (field, limit) {
			var crossbar = DDPServer._InvalidationCrossbar,
				copy = parentDoc[field],
				userId = sub.userId;

			parentDoc[field] = copy.slice(skip, skip + limit);

			var listener = crossbar.listen({userId: userId, field: field}, function (data) {
				if(userId == data.userId && addStarted) {
					if(data.inc)
						skip += limit;
					else if(skip > 10)
						skip -= limit;

					var changes = {};
					changes[field] = copy.slice(skip, skip + limit);

					sub.changed(name, _id, changes);
				}
			});

			observes[_id].push(listener);
		};

		var cb = callback.call(_add, _id, parentDoc, addStarted);
		if(addStarted)
			sub.changed(name, _id, cb || parentDoc);
		else
			sub.added(name, _id, cb || parentDoc);

		addStarted = true;
	};

	var cursorObserveChanges = cursor.observeChanges({
		added: function (id, doc) {
			addStarted = false;
			_add(id, doc);
		},
		changed: function (id, doc) {
			addStarted = true;
			// the true is indicate to the callback that the doc has changed
			_add(id, doc, true);
		},
		removed: function (id) {
			sub.removed(name, id);
			if(observes[id])
				stopObserves(observes[id]);
		}
	});

	sub.onStop(function () {
		cursorObserveChanges.stop();

		for (var key in observes) {
			stopObserves(observes[key]);
		};
		//_.forIn(observes, stopObserves);
		observes = [];
	});

	// I do not think it necessary to send the Ready from here
	// return sub.ready();
};