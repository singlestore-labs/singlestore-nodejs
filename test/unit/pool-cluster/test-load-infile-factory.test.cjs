'use strict';

const { EventEmitter } = require('node:events');
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

cluster.end();
