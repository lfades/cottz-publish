Package.describe({
  summary: "Edit the documents to your liking before sending",
  version: "2.0.3",
  git: "https://github.com/Goluis/meteor-publish-with-relations.git"
});

Package.onUse(function(api) {
  configure(api);

  api.export('Publish', 'server');
});

Package.on_test(function (api) {
  configure(api);

  api.use(['tinytest', 'random']);

  api.addFiles('tests/data.js', 'server');
  api.addFiles('tests/publish.js', 'server');
  api.addFiles('tests/relations.js', 'server');
});

function configure (api) {
  api.versionsFrom('1.0');

  api.use('underscore', 'server');

  api.addFiles('handler_controller.js', 'server');
  api.addFiles('publish.js', 'server');
  api.addFiles('publish_relations.js', 'server');
  api.addFiles('relations_methods.js', 'server');
  api.addFiles('methods.js', 'server');
};