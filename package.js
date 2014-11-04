Package.describe({
  summary: "Edit the documents to your liking before sending",
  version: "1.6.5",
  git: "https://github.com/Goluis/meteor-publish-with-relations.git"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.1');

  api.use('underscore', 'server');
  api.addFiles('publish.js', 'server');
  api.addFiles('methods.js', 'server');

  api.export('publishCursor', 'server');
  api.export('publishWithRelations', 'server');
  api.export('Publish', 'server');
});