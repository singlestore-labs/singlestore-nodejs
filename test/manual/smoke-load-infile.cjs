'use strict';

/**
 * Manual smoke test for LOAD DATA LOCAL INFILE (file + infileStream).
 *
 * Usage (SingleStore dev container or any MySQL-compatible server with local infile):
 *
 *   export MYSQL_HOST=127.0.0.1
 *   export MYSQL_USER=root
 *   export MYSQL_PASSWORD=your_password
 *   export MYSQL_DATABASE=test
 *   node test/manual/smoke-load-infile.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const singlestore = require('../../index.js');

const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'test',
};

const table = 'smoke_load_infile';
const fixture = path.join(__dirname, '../fixtures/data.csv');

function query(conn, sql, values) {
  return new Promise((resolve, reject) => {
    if (typeof sql === 'object') {
      conn.query(sql, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
      return;
    }
    conn.query(sql, values, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function main() {
  console.log(
    'Connecting to',
    `${config.user}@${config.host}:${config.port}/${config.database}`
  );

  const conn = singlestore.createConnection({
    ...config,
    infileStreamFactory: (requestedPath) => {
      const allowed = [path.resolve(fixture)];
      const resolved = path.resolve(requestedPath);
      if (!allowed.includes(resolved)) {
        throw new Error(`refusing path: ${requestedPath}`);
      }
      return fs.createReadStream(resolved);
    },
  });

  await new Promise((resolve, reject) => {
    conn.connect((err) => (err ? reject(err) : resolve()));
  });
  console.log('Connected.');

  try {
    await query(conn, 'SET GLOBAL local_infile = true').catch(() => {
      console.log(
        'Note: SET GLOBAL local_infile skipped (no privilege or managed DB).'
      );
    });

    await query(
      conn,
      [
        `DROP TABLE IF EXISTS \`${table}\``,
        `CREATE TABLE \`${table}\` (`,
        '  id INT,',
        '  title VARCHAR(255)',
        ')',
      ].join('\n')
    );

    const fileLoad = await query(conn, {
      sql: `LOAD DATA LOCAL INFILE ? INTO TABLE \`${table}\` FIELDS TERMINATED BY ',' (id, title)`,
      values: [fixture],
    });
    console.log('File load affectedRows:', fileLoad.affectedRows);

    const rowsAfterFile = await query(
      conn,
      `SELECT COUNT(*) AS c FROM \`${table}\``
    );
    console.log('Row count after file load:', rowsAfterFile[0].c);

    await query(conn, `TRUNCATE TABLE \`${table}\``);

    const streamLoad = await query(conn, {
      sql: `LOAD DATA LOCAL INFILE ':stream:' INTO TABLE \`${table}\` FIELDS TERMINATED BY ',' (id, title)`,
      infileStream: Readable.from(['99,FromStream\n', '100,StillStream\n']),
    });
    console.log('Memory stream load affectedRows:', streamLoad.affectedRows);

    const rowsAfterStream = await query(
      conn,
      `SELECT * FROM \`${table}\` ORDER BY id`
    );
    console.log('Rows after stream load:', rowsAfterStream);

    const disabled = singlestore.createConnection({
      ...config,
      local_infile: false,
    });
    await new Promise((resolve, reject) => {
      disabled.connect((err) => (err ? reject(err) : resolve()));
    });
    let blocked = false;
    try {
      await query(disabled, {
        sql: `LOAD DATA LOCAL INFILE ':stream:' INTO TABLE \`${table}\` FIELDS TERMINATED BY ',' (id, title)`,
        infileStream: Readable.from(['1,x\n']),
      });
    } catch (err) {
      blocked = /Local infile is disabled by connector/.test(err.message);
      console.log('local_infile:false blocked load:', err.message);
    }
    if (!blocked) {
      throw new Error(
        'Expected local_infile:false to block LOAD DATA LOCAL INFILE'
      );
    }
    disabled.end();

    console.log('\nSmoke test passed.');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error('\nSmoke test failed:', err.message || err);
  process.exit(1);
});
