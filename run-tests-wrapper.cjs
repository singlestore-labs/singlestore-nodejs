'use strict';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const testFile = process.argv[2];

if (!testFile) {
  console.error('Please provide a test file path as an argument.');
  process.exit(1);
}

// Dynamically import ES modules, require for CommonJS
(async () => {
  if (testFile.endsWith('.mjs')) {
    await import(testFile);
  } else {
    require(testFile);
  }
})();
