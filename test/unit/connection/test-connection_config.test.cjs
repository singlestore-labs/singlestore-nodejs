'use strict';

const ConnectionConfig = require('../../../lib/connection_config.js');
const ClientConstants = require('../../../lib/constants/client.js');
const { assert } = require('poku');

const expectedMessage = "SSL profile must be an object, instead it's a boolean";

assert.throws(
  () =>
    new ConnectionConfig({
      ssl: true,
    }),
  (err) => err instanceof TypeError && err.message === expectedMessage,
  'Error, the constructor accepts a boolean without throwing the right exception'
);

assert.doesNotThrow(
  () =>
    new ConnectionConfig({
      ssl: {},
    }),
  'Error, the constructor accepts an object but throws an exception'
);

assert.doesNotThrow(() => {
  const SSLProfiles = require('../../../lib/constants/ssl_profiles.js');
  const sslProfile = Object.keys(SSLProfiles)[0];
  new ConnectionConfig({
    ssl: sslProfile,
  });
}, 'Error, the constructor accepts a string but throws an exception');

assert.doesNotThrow(() => {
  new ConnectionConfig({
    flags: '-FOUND_ROWS',
  });
}, 'Error, the constructor threw an exception due to a flags string');

assert.doesNotThrow(() => {
  new ConnectionConfig({
    flags: ['-FOUND_ROWS'],
  });
}, 'Error, the constructor threw an exception due to a flags array');

assert.strictEqual(
  ConnectionConfig.parseUrl(
    String.raw`fml://test:pass!%40%24%25%5E%26*()word%3A@www.example.com/database`
  ).password,
  'pass!@$%^&*()word:'
);

assert.strictEqual(
  ConnectionConfig.parseUrl(
    String.raw`fml://user%40test.com:pass!%40%24%25%5E%26*()word%3A@www.example.com/database`
  ).user,
  'user@test.com'
);

assert.strictEqual(
  ConnectionConfig.parseUrl(
    String.raw`fml://test:pass@wordA@fe80%3A3438%3A7667%3A5c77%3Ace27%2518/database`
  ).host,
  'fe80:3438:7667:5c77:ce27%18'
);

assert.strictEqual(
  ConnectionConfig.parseUrl(
    String.raw`fml://test:pass@wordA@www.example.com/database`
  ).host,
  'www.example.com'
);

assert.strictEqual(
  ConnectionConfig.parseUrl(
    String.raw`fml://test:pass@wordA@www.example.com/database%24`
  ).database,
  'database$'
);

const hasLocalFiles = (config) =>
  (config.clientFlags & ClientConstants.LOCAL_FILES) !== 0;

const defaultConfig = new ConnectionConfig({});
assert.strictEqual(defaultConfig.localInfile, true);
assert.strictEqual(hasLocalFiles(defaultConfig), true);

const disabledConfig = new ConnectionConfig({ local_infile: false });
assert.strictEqual(disabledConfig.localInfile, false);
assert.strictEqual(hasLocalFiles(disabledConfig), false);

assert.strictEqual(
  new ConnectionConfig({ local_infile: 0 }).localInfile,
  false
);
assert.strictEqual(
  new ConnectionConfig({ local_infile: 'false' }).localInfile,
  false
);

const optedOut = new ConnectionConfig({ flags: '-LOCAL_FILES' });
assert.strictEqual(optedOut.localInfile, false);
assert.strictEqual(hasLocalFiles(optedOut), false);

const forcedOn = new ConnectionConfig({
  local_infile: true,
  flags: '-LOCAL_FILES',
});
assert.strictEqual(forcedOn.localInfile, true);
assert.strictEqual(hasLocalFiles(forcedOn), true);

const forcedOff = new ConnectionConfig({
  local_infile: false,
  flags: 'LOCAL_FILES',
});
assert.strictEqual(forcedOff.localInfile, false);
assert.strictEqual(hasLocalFiles(forcedOff), false);
