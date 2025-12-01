'use strict';

const common = require('../../common.test.cjs');
const { assert } = require('poku');
const driver = require('../../../index.js');

const configURI = `mysql://${common.config.user}:${common.config.password}@${common.config.host}:${common.config.port}/${common.config.database}`;
const connectionConfig = {
  uri: configURI,
  // debug: true,
  sessionVariables: {
    sql_select_limit: 100,
    sql_mode: 'STRICT_ALL_TABLES',
    autocommit: 0,
  },
};

function checkSessionVars(conn) {
  conn.query(
    'SELECT @@sql_select_limit, @@sql_mode, @@autocommit',
    (err, rows, fields) => {
      if (err) {
        throw err;
      }
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
      conn.end();
    }
  );
}

const connection = driver.createConnection(connectionConfig);
const pool = driver.createPool(connectionConfig);

checkSessionVars(connection);
checkSessionVars(pool);
