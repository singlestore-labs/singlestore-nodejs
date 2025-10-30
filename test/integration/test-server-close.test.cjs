// // Copyright (c) 2021, Oracle and/or its affiliates.

// 'use strict';

// const errors = require('../../lib/constants/errors.js');
// const common = require('../common.test.cjs');
// const mysql = require('../../index.js');
// const assert = require('node:assert');
// const process = require('node:process');

// if (`${process.env.MYSQL_CONNECTION_URL}`.includes('pscale_pw_')) {
//   console.log('skipping test for planetscale');
//   process.exit(0);
// }

// // Uncaught AssertionError: Connection lost: The server closed the connection. == The client was disconnected by the server because of inactivity. See wait_timeout and interactive_timeout for configuring this behavior.
// if (typeof Deno !== 'undefined') process.exit(0);

// const connection = common.createConnection();

// const customWaitTimeout = 1; // seconds

// let error;

// connection.on('error', (err) => {
//   error = err;

//   connection.close();
// });

// connection.query(`set wait_timeout=${customWaitTimeout}`, () => {
//   setTimeout(() => {}, customWaitTimeout * 1000 * 2);
// });

// process.on('uncaughtException', (err) => {
//   // The ERR Packet is only sent by MySQL server 8.0.24 or higher, so we
//   // need to account for the fact it is not sent by older server versions.
//   if (err.code !== 'ERR_ASSERTION') {
//     throw err;
//   }

//   assert.equal(
//     error.message,
//     'Connection lost: The server closed the connection.'
//   );
//   assert.equal(error.code, 'PROTOCOL_CONNECTION_LOST');
// });

// process.on('exit', () => {
//   assert.equal(
//     error.message,
//     'The client was disconnected by the server because of inactivity. See wait_timeout and interactive_timeout for configuring this behavior.'
//   );
//   assert.equal(error.code, errors.ER_CLIENT_INTERACTION_TIMEOUT);
// });
// test-pool.js
// import mysql from 'mysql2/promise';


'use strict';

const mysql = require('../../promise.js'); // Use promise-based API
const common = require('../common.test.cjs');
const { assert } = require('poku');
const process = require('node:process');

if (`${process.env.MYSQL_CONNECTION_URL}`.includes('pscale_pw_')) {
  console.log('skipping test for planetscale');
  process.exit(0);
}

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'test',
  connectionLimit: 2,
});

// const connect = common.createConnection();

async function main() {
  let conn1, conn2, conn3;
  
  try {
    conn1 = await pool.getConnection();
    
    // Get details for the first connection
    const [info] = await conn1.query(`
      SELECT CONNECTION_ID() AS connection_id, VERSION() AS version, @@memsql_version, @@aggregator_id
    `);
    console.log('Connection 1 info:', info);
    const { connection_id } = info[0];
    
    console.log(`Connection 1 ID: ${connection_id}`);
    
    // Get another connection to kill the first one
    conn2 = await pool.getConnection();
    // conn3 = await pool.getConnection();
     // Get details for the second connection
     const [info2] = await conn2.query(`
      SELECT CONNECTION_ID() AS connection_id, VERSION() AS version, @@memsql_version, @@aggregator_id
    `);
    console.log('Connection 2 info:', info2);
    const connection_id2 = info2[0].connection_id;
    
    console.log(`Connection 2 ID: ${connection_id2}`);
    
    console.log(`Killing connection ${connection_id}...`);
    
    // Use standard MySQL KILL syntax (works for both MySQL and SingleStore)
    await conn2.query(`KILL CONNECTION ${connection_id}`);
    console.log('Kill command sent.');
    
    // Give the server time to process the kill
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now try to use conn1 again - this should fail
    try {
      await conn1.query('SELECT 1');
      console.log('Expected query to fail after connection was killed');
    } catch (err) {
      console.log('Got expected error:', err.message);
      // Verify it's the right type of error
      assert.ok(
        err.code === 'PROTOCOL_CONNECTION_LOST' || 
        err.message.includes('connection is in closed state'),
        `Expected connection lost error, got: ${err.code} - ${err.message}`
      );
    }

    // connect.query(`KILL CONNECTION ${connection_id2}`)
    // console.log(`Killed connection ${connection_id2} from connect.`);

    conn3 = await pool.getConnection();
    const [info3] = await conn3.query(`
      SELECT CONNECTION_ID() AS connection_id, VERSION() AS version, @@memsql_version, @@aggregator_id
    `);

    console.log('Connection 3 info:', info3);
    try {
      await conn3.query('SELECT 1');
      console.log('3rd connection query succeeded as expected.');
    } catch (err) {
      console.log('Got error for 3rd connection:', err.message);
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
    throw err;
  } finally {
    // Cleanup connections
    if (conn1) {
      try { conn1.release(); } catch (e) { /* Connection might be dead */ }
    }
    if (conn2) {
      try { conn2.release(); } catch (e) { /* Ignore cleanup errors */ }
    }
    if (conn3) {
      try { conn3.release(); } catch (e) { /* Ignore cleanup errors */ }
    }
    // if(connect)
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});