meteor-publish-with-relations
=============================

Edit your documents before sending them with PublishWithRelations

## Installation

```sh
$ meteor add cottz:publish-with-relations
```

provides a number of methods to easily manipulate data using internally observe and observeChanges in the server

## Quick Start
Assuming we have the following collections
```js
// Authors
{
  _id: 'someAuthorId',
  name: 'Luis',
  profile: 'someProfileId',
  bio: 'I am a very good and happy author',
  interests: ['writing', 'reading', *others*]
}

// Reviews
{
  _id: 'someReviewId',
  authorId: 'someAuthorId',
  book: 'meteor for pros',
  text: 'this book is not better than mine'
}

// Books
{
  _id: 'someBookId',
  authorId: 'someAuthorId',
  name: 'meteor for dummies'
}

// Comments
{
  _id: 'someCommentId',
  bookId: 'someBookId',
  text: 'This book is better than meteor for pros :O'
}
```
I want publish the autor with his books
```js
Meteor.publish('author', function (authorId) {
  publishWithRelations(this, Authors.find(authorId), function (id, doc) {
    this.cursor(Books.find({authorId: id}));
  });
  
  return this.ready();
});
```
and comments of the books
```js
Meteor.publish('author', function (authorId) {
  publishWithRelations(this, Authors.find(authorId), function (id, doc) {
    this.cursor(Books.find({authorId: id}), function (id, doc) {
      this.cursor(Comments.find({bookId: id}));
    });
  });
  
  return this.ready();
});
```
I also want to bring the profile of the author but within the author not apart
```js
Meteor.publish('author', function (authorId) {
  publishWithRelations(this, Authors.find(authorId), function (id, doc) {
    this.cursor(Books.find({authorId: id}), function (id, doc) {
      this.cursor(Comments.find({bookId: id}));
    });
    
    doc.profile = this.changeParentDoc(Profiles.find(doc.profile), function (profile) {
      return profile;
    });
  });
  
  return this.ready();
});
```
I want to include the reviews of the author within this
```js
Meteor.publish('author', function (authorId) {
  publishWithRelations(this, Authors.find(authorId), function (id, doc) {
    this.cursor(Books.find({authorId: id}), function (id, doc) {
      this.cursor(Comments.find({bookId: id}));
    });
    
    doc.profile = this.changeParentDoc(Profiles.find(doc.profile), function (profile) {
      return profile;
    });
    
    doc.reviews = this.group(Reviews.find({authorId: id}), function (doc, index) {
      return doc;     
    }, 'reviews');
  });
  
  return this.ready();
});
// doc.reviews = [{data}, {data}]
```
To finish I want to show only some interests of the author
```js
Meteor.publish('author', function (authorId) {
  publishWithRelations(this, Authors.find(authorId), function (id, doc) {
    this.cursor(Books.find({authorId: id}), function (id, doc) {
      this.cursor(Comments.find({bookId: id}));
    });
    
    doc.profile = this.changeParentDoc(Profiles.find(doc.profile), function (profile) {
      return profile;
    });
    
    doc.reviews = this.group(Reviews.find({authorId: id}), function (doc, index) {
      return doc;     
    }, 'reviews');
    
    doc.interests = this.paginate({interests: doc.interests}, 5);
  });
  
  return this.ready();
});
// doc.reviews = [{data}, {data}]

// Client
// send true increases by 5 the interests and false decreases
Meteor.call('changePagination', 'interests', true);
```

### publishWithRelations (this, options, callback)
* You can edit the document directly (doc.property = 'some') or send it in the return.
* **this** is the this of the publication
* **options** is an object like this: `{cursor: Authors.find(), cursorName: 'authors'}` or just a cursor
* **callback** receives 3 parameters: (`id`, `doc`, `changed`)

## Methods
after starting a publishWithRelations you can use the methods in `this` within the `callback`

### this.cursor (cursor, cursorName, callback (id, doc, changed))
publishes a cursor for the collection in `cursorName`, Only the first parameter is required, you can send the callback as the second parameter. If you send a callback you can use `this` again.
* **Note:** do not use in this.cursor() the this of publishWithRelations unless necessary
* You can edit the document directly (doc.property = 'some') or send it in the return

### this.changeParentDoc (cursor, callback)
designed to change something in the master document while the `callback` is executed. Changes to the document are sent to the main document with the return of the `callback`
* **callback** receive (`doc`) when is added and (`doc`, `oldDoc`, `atIndex`) when is changed

### this.group (cursor, callback, field, options)
returns an array of elements with all documents in the cursor. When there is a change it will update the element change in the resulting array and send it back to the document
* **callback** receive (`doc`, `atIndex`) when is added and (`doc`, `atIndex`, `oldDoc`) when is changed
* **field** is the field in the main document that has the array
* **options (not required)** is an object like this: `{sort: array, sortField: '_id'}` implements changes based on the position within the `sort`. `sort` is an array of values and `sortField` is the field of the document where they are, by default is the _id

### this.paginate (field, limit, infinite)
page within an array without re run the publication or callback
* **field** is an object where the key is the field in the document and the value an array
* **limit** the total number of values in the array to show
* **infinite** if true the above values are not removed when the paging is increased
* **Meteor.call('changePagination', 'field', boolean)** changes the pagination in the `field` with the `boolean`, true increases and false decreases
* returns the paginated array, be sure to change it in the document

## publishCursor (cursor, this, collectionName)
publishes a cursor, `collectionName` is not required

### Note: do not forget to use this.ready() to finish writing the publication, not included by default.