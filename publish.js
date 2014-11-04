function publish () {};

function stopObserves (docObserves) {
	for (var key in docObserves) {
		docObserves[key].stop();
	};
	//_.forIn(docObserves, function (observe) {
	//	observe.stop();
	//});
};

_.extend(publish.prototype, {
	cursor: function (cursor, sub, collectionName) {
		if(!collectionName)
			collectionName = cursor._cursorDescription.collectionName;
		Meteor.Collection._publishCursor(cursor, sub, collectionName);
	},
	observe: function (sub, cursor, callbacks, withOnStop) {
		var observeHandle = cursor.observe(callbacks);

		if(!withOnStop) {
			sub.onStop(function () {
				observeHandle.stop();
			});
		}

		return observeHandle;
	},
	observeChanges: function (sub, cursor, callbacks, withOnStop) {
		var observeHandle = cursor.observeChanges(callbacks);

		if(!withOnStop) {
			sub.onStop(function () {
				observeHandle.stop();
			});
		}

		return observeHandle;
	},
	/******************************************************************************************************
	//// PUBLISH WITH RELATIONS \\\\
	*******************************************************************************************************/
	relations: function (sub, options, callback) {
		var observes = [],
			cursor = options.cursor || options,
			name = options.name || cursor._cursorDescription.collectionName,
			addStarted = false,
			results = [],
			skip = 0;

		if(!cursor)
			throw new Error("you're not sending the cursor");

		function _add (_id, name) {
			if(addStarted) {
				stopObserves(observes[_id]);
				observes[_id] = [];
			} else if(!observes[_id])
				observes[_id] = [];

			this._id = _id;
			this.name = name;
			this.newLiveQuery = function (observe) {
				observes[_id].push(observe);
				return observe;
			};
		};

		_.extend(_add.prototype, {
			observe: function (sub, cursor, callbacks) {
				this.newLiveQuery(publish.prototype.observe(sub, cursor, callbacks, true));
			},
			observeChanges: function (sub, cursor, callbacks) {
				this.newLiveQuery(publish.prototype.observeChanges(sub, cursor, callbacks, true));
			},
			// make parameter is a callback
			// adds a new cursor in a different collection to the main
			cursor: function (cursor, cursorName, make) {
				var type = typeof cursorName == 'function';
				if(!cursorName || type) {
					if(type)
						make = cursorName;

					cursorName = cursor._cursorDescription.collectionName;
				}
				
				var observe = cursor.observeChanges({
					added: function (id, doc) {
						var cb = make ? make.call(new _add(id, cursorName), id, doc): null;
						sub.added(cursorName, id, cb || doc);
					},
					changed: function (id, doc) {
						var cb = make ? make.call(new _add(id, cursorName), id, doc, true): null;
						sub.changed(cursorName, id, cb || doc);
					},
					removed: function (id) {
						sub.removed(cursorName, id);
						var obv = observes[id];
						if(obv) {
							stopObserves(obv);
							delete observes[id];
						}
					}
				});

				return this.newLiveQuery(observe);
			},
			// designed to change something in the master document while the 'make' is executed
			// changes to the document are sent to the main document with the return of the 'make'
			changeParentDoc: function (cursor, make) {
				var _id = this._id, result;

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

				this.newLiveQuery(observe);
				return result;
			},
			// returns an array of elements with all documents in the cursor
			// when there is a change it will update the element change in the resulting array
			// and send it back to the collection
			group: function (cursor, make, field, options) {
				var _id = this._id, result = [];

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

				this.newLiveQuery(observe);
				return result;
			},
			// reactively change a field in the main document
			// is designed to handle only 1 document
			// returns the document found in the cursor, if the document _id is equal to a previous
			// query (query assumes that is the _id) returns the document from the previous query 
			// again without performing the same query and when a change will update everyone calling parameter onChanged
			field: function (cursor, query, onChanged) {
				var _id = this._id, result = results[query];

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

								for (var id in _ids)
									sub.changed(name, _ids[id], changes);

								doc._id = _ids
								results[docId] = doc;

								break;
							}
						}
					};

					observe.changed = changeDoc;
					observe.removed = changeDoc;
				}

				this.newLiveQuery(cursor.observe(observe));

				result = _.clone(results[query]);
				result._id = query;
				return result;
			},
			// designed to paginate a list, works in conjunction with the methods
			// do not call back to the main callback, only the array is changed in the collection
			paginate: function (fieldData, limit, infinite) {
				var _id = this._id,
					crossbar = DDPServer._InvalidationCrossbar,
					field = Object.keys(fieldData)[0],
					copy = _.clone(fieldData)[field],
					max = copy.length,
					id = sub.connection.id;

				fieldData[field] = copy.slice(skip, skip + limit);

				if(infinite)
					skip += 10;

				var listener = crossbar.listen({connection: id, field: field}, function (data) {
					if(id == data.connection && addStarted) {
						if(data.inc && skip < max)
							skip += limit;
						else if(skip >= limit)
							skip -= limit;

						fieldData[field] = infinite ? copy.slice(0, skip): copy.slice(skip, skip + limit);
						sub.changed(name, _id, fieldData);
					}
				});

				this.newLiveQuery(listener);
				return fieldData[field];
			}
		});

		function _sendData (_id, parentDoc) {
			var _addData = new _add(_id, name);

			var cb = callback.call(_addData, _id, parentDoc, addStarted);
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
				_sendData(id, doc);
			},
			changed: function (id, doc) {
				addStarted = true;
				// the true is indicate to the callback that the doc has changed
				_sendData(id, doc, true);
			},
			removed: function (id) {
				sub.removed(name, id);
				if(observes[id])
					stopObserves(observes[id]);
			}
		});

		function stopCursor () {
			cursorObserveChanges.stop();

			for (var key in observes) {
				stopObserves(observes[key]);
			};
			//_.forIn(observes, stopObserves);
			observes = [];
		};

		sub.onStop(stopCursor);
		// I do not think it necessary to send the Ready from here
		// return sub.ready();
		return {
			stop: stopCursor
		};
	}
});

publishCursor = publish.prototype.cursor;
publishWithRelations = publish.prototype.relations;

Publish = new publish();