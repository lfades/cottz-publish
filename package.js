Package.describe({
  summary: "edit your documents before sending them with PublishWithRelations",
  version: "1.0.0",
  git: ""
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.1');

  api.use('underscore', 'server');
  api.addFiles('publish-with-relations.js', 'server');
  api.addFiles('methods.js', 'server');

  api.export('publishCursor', 'server');
  api.export('publishWithRelations', 'server');
});