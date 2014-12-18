Tinytest.addAsync('Cursor', function (test, done) {
	var quotes = new Mongo.Collection(Random.id()),
		publish = Random.id(),
		docs = data.quotes;

	for (var doc in docs) {
		quotes.insert(docs[doc]);
	};

	Meteor.publish(publish, function () {
		Publish.cursor(quotes.find(), this);
		return this.ready();
	});

	var client = Client();
	client._livedata_data = function (msg) {
		if(msg.msg == 'added') {
			test.equal(msg.fields, quotes.findOne({_id: msg.id}, {fields: {_id: 0}}));
		} else if (msg.msg == 'ready') {
			client.disconnect();
			done();
		}
	};

	client.subscribe(publish);
});

Tinytest.addAsync('Observes', function (test, done) {
	var quotes = new Mongo.Collection(Random.id()),
		publish = Random.id(),
		publish2 = Random.id(),
		docs = data.quotes;

	for (var doc in docs) {
		quotes.insert(docs[doc]);
	}

	Meteor.publish(publish, function () {
		Publish.observe(quotes.find(), {}, this);
		return this.ready();
	});

	Meteor.publish(publish2, function () {
		Publish.observeChanges(quotes.find(), {}, this);
		return this.ready();
	});

	var client = Client();
	client._livedata_data = function (msg) {
		test.equal(msg.msg, 'ready');
		client.disconnect();
	};

	client.subscribe(publish);


	var client2 = Client();
	client2._livedata_data = function (msg) {
		test.equal(msg.msg, 'ready');
		client2.disconnect();
		done();
	};
	
	client2.subscribe(publish2);
});