// No-op — bun workspace resolution handles node_modules correctly.
// Previously this symlinked root node_modules, but that broke
// bun's internal package resolution (.bun/ cache symlinks).
console.log('@pulse/desktop: postinstall OK');
