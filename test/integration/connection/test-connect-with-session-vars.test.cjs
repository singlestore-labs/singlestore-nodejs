'use strict';

const common = require('../../common.test.cjs');
const { assert } = require('poku');
const process = require('node:process');

if (process.env.MYSQL_CONNECTION_URL) {
  console.log(
    'skipping test when mysql server is configured using MYSQL_CONNECTION_URL'
  );
  process.exit(0);
}

const connection = common.createConnectionWithSessionVars();

let rows;
let fields;
connection.query(
  'SELECT @@sql_select_limit, @@sql_mode, @@autocommit',
  (err, _rows, _fields) => {
    if (err) {
      throw err;
    }

    rows = _rows;
    fields = _fields;
    connection.end();
  }
);

process.on('exit', () => {
  assert.deepEqual(rows, [
    {
      '@@sql_select_limit': 100,
      '@@sql_mode': 'STRICT_ALL_TABLES',
      '@@autocommit': 0,
    },
  ]);
  assert.equal(fields[0].name, '@@sql_select_limit');
  assert.equal(fields[1].name, '@@sql_mode');
  assert.equal(fields[2].name, '@@autocommit');
});
