'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { assert } = require('poku');

const PoolCluster = require('../../../lib/pool_cluster.js');

const cluster = new PoolCluster({ canRetry: false });
const namespace = cluster.of('MASTER');
const connectionFactory = function connectionFactory() {};
let queried;

namespace.getConnection = (cb) => {
  cb(null, {
    config: { infileStreamFactory: connectionFactory },
    query(command) {
      queried = command;
      return new EventEmitter();
    },
  });
};

const inherited = namespace.query({ sql: 'SELECT 1' });
assert.equal(inherited._streamFactory, connectionFactory);
assert.equal(queried, inherited);

const customFactory = function customFactory() {};
const explicit = namespace.query({
  sql: 'SELECT 1',
  infileStreamFactory: customFactory,
});
assert.equal(explicit._streamFactory, customFactory);

const stream = new PassThrough();
const streamed = namespace.query({
  sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
  infileStream: stream,
});
assert.equal(streamed._infileStream, stream);
assert.equal(streamed._streamFactory, connectionFactory);

cluster.end();
