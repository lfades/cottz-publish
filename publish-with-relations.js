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

		_add.cursor = function (cursor, cursorName, make) {
			if(!cursorName)
				cursorName = cursor._cursorDescription.collectionName;
			
			var observe = cursor.observeChanges({
				added: function (id, doc) {
					var cb = make ? make(id, doc): null;
					// Cuando la colección que va antes que esta se ejecuta de nuevo por un cambio 
					// es muy probable que esta se vuelva a ejecutar, para eso nos aseguramos de que 
					// cuando ocurra sea un changed en lugar de un added otra ves.
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
		
		// is in testing
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
		// Siempre que haya un cambio se vuelve a llamar al callback
		// para que formule de nuevo los datos con la información nueva
		added: function (id, doc) {
			addStarted = false;
			_add(id, doc);
		},
		changed: function (id, doc) {
			addStarted = true;
			// el true es para indicar al callback que el documento a cambiado
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