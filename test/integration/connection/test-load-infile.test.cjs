'use strict';

const common = require('../../common.test.cjs');
const { assert } = require('poku');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const process = require('node:process');
const mysql = require('../../../index.js');

const LOCAL_INFILE_DISABLED_MESSAGE =
  'Local infile is disabled by connector. Enable `local_infile` to allow local infile commands';

if (`${process.env.MYSQL_CONNECTION_URL}`.includes('pscale_pw_')) {
  console.log('skipping test for planetscale');
  process.exit(0);
}

const connection = common.createConnection();

const table = 'load_data_test';
connection.query('SET GLOBAL local_infile = true', assert.ifError);
connection.query(
  [
    `CREATE TEMPORARY TABLE \`${table}\` (`,
    '`id` int(11) unsigned NOT NULL AUTO_INCREMENT,',
    '`title` varchar(255),',
    'PRIMARY KEY (`id`)',
    ')',
  ].join('\n')
);

const path = './test/fixtures/data.csv';
const sql =
  `LOAD DATA LOCAL INFILE ? INTO TABLE ${table} ` +
  `FIELDS TERMINATED BY ? (id, title)`;

let ok;
connection.query(
  {
    sql,
    values: [path, ','],
    infileStreamFactory: () => fs.createReadStream(path),
  },
  (err, _ok) => {
    if (err) {
      throw err;
    }
    ok = _ok;
  }
);

let rows;
connection.query(`SELECT * FROM ${table} order by id`, (err, _rows) => {
  if (err) {
    throw err;
  }
  rows = _rows;
});

// Try to load a file that does not exist to see if we handle this properly
let loadErr;
let loadResult;
const badPath = '/does_not_exist.csv';

connection.query(sql, [badPath, ','], (err, result) => {
  loadErr = err;
  loadResult = result;
});

// test path mapping
const createMyStream = function () {
  const Stream = require('node:stream').PassThrough;
  const myStream = new Stream();
  setTimeout(() => {
    myStream.write('11,Hello World\n');
    myStream.write('21,One ');
    myStream.write('more row\n');
    myStream.end();
  }, 1000);
  return myStream;
};

let streamResult;
let memoryResult;
let disabledErr;
connection.query(
  {
    sql: sql,
    values: [badPath, ','],
    infileStreamFactory: createMyStream,
  },
  (err, result) => {
    if (err) {
      throw err;
    }
    streamResult = result;
    connection.query(
      {
        sql: `LOAD DATA LOCAL INFILE ':stream:' INTO TABLE ${table} FIELDS TERMINATED BY ',' (id, title)`,
        infileStream: Readable.from([
          '31,From Memory\n',
          '32,Still',
          ' Memory\n',
        ]),
        infileStreamFactory: () => {
          throw new Error(
            'infileStreamFactory must not run when infileStream is set'
          );
        },
      },
      (memErr, memResult) => {
        if (memErr) {
          throw memErr;
        }
        memoryResult = memResult;
        const disabled = mysql.createConnection({
          ...common.config,
          local_infile: false,
        });
        disabled.query(
          [
            `CREATE TEMPORARY TABLE \`${table}\` (`,
            '`id` int(11) unsigned NOT NULL,',
            '`title` varchar(255)',
            ')',
          ].join('\n'),
          (createErr) => {
            if (createErr) {
              throw createErr;
            }
            disabled.query(
              {
                sql: `LOAD DATA LOCAL INFILE ':stream:' INTO TABLE ${table} FIELDS TERMINATED BY ',' (id, title)`,
                infileStream: Readable.from(['99,should-not-load\n']),
              },
              (loadError) => {
                disabledErr = loadError;
                disabled.end(() => {
                  connection.end();
                });
              }
            );
          }
        );
      }
    );
  }
);

process.on('exit', () => {
  assert.equal(ok.affectedRows, 4);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].title.trim(), 'Hello World');

  assert.equal(
    loadErr.message,
    `As a result of LOCAL INFILE command server wants to read /does_not_exist.csv file, but as of v2.0 you must provide streamFactory option returning ReadStream.`
  );
  assert.equal(loadResult.affectedRows, 0);

  assert.equal(streamResult.affectedRows, 2);
  assert.equal(memoryResult.affectedRows, 2);
  assert.equal(disabledErr.message, LOCAL_INFILE_DISABLED_MESSAGE);
});
