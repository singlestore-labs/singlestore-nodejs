'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { assert } = require('poku');

const PoolCluster = require('../../../lib/pool_cluster.js');
const ClientConstants = require('../../../lib/constants/client.js');

// PoolCluster builds its Query before it knows which connection it will get,
// so the query carries no factory. The connection-level infileStreamFactory
// must still be used when the server requests the file.

function fakeConnection(infileStreamFactory) {
  const conn = new EventEmitter();
  conn.stream = new EventEmitter();
  conn.packets = [];
  conn.writePacket = (packet) => conn.packets.push(packet);
  conn.config = {
    clientFlags: ClientConstants.LOCAL_FILES,
    infileStreamFactory,
  };
  conn.query = (command) => {
    conn.queried = command;
    return new EventEmitter();
  };
  return conn;
}

const cluster = new PoolCluster({ canRetry: false });
const namespace = cluster.of('MASTER');

// Inherits the connection-level factory.
{
  let requestedPath;
  const conn = fakeConnection((path) => {
    requestedPath = path;
    return new PassThrough();
  });
  namespace.getConnection = (cb) => cb(null, conn);

  const query = namespace.query("LOAD DATA LOCAL INFILE 'a.csv' INTO TABLE t");
  assert.equal(conn.queried, query);
  query._streamLocalInfile(conn, 'a.csv');
  assert.equal(requestedPath, 'a.csv');
  assert.equal(query._localStreamError, undefined);
  query._unpipeStream();
}

// A per-query factory takes priority over the connection-level one.
{
  let connectionFactoryCalled = false;
  let queryFactoryCalled = false;
  const conn = fakeConnection(() => {
    connectionFactoryCalled = true;
    return new PassThrough();
  });
  namespace.getConnection = (cb) => cb(null, conn);

  const query = namespace.query({
    sql: "LOAD DATA LOCAL INFILE 'b.csv' INTO TABLE t",
    infileStreamFactory: () => {
      queryFactoryCalled = true;
      return new PassThrough();
    },
  });
  query._streamLocalInfile(conn, 'b.csv');
  assert.equal(queryFactoryCalled, true);
  assert.equal(connectionFactoryCalled, false);
  query._unpipeStream();
}

cluster.end();
