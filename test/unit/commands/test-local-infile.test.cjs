'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { assert } = require('poku');

const Command = require('../../../lib/commands/command.js');
const Query = require('../../../lib/commands/query.js');
const Packets = require('../../../lib/packets/index.js');
const ClientConstants = require('../../../lib/constants/client.js');
const {
  LOCAL_INFILE_DISABLED_MESSAGE,
  rewriteLocalInfileError,
} = require('../../../lib/commands/local_infile.js');

class FakeConnection extends EventEmitter {
  constructor(config) {
    super();
    this.packets = [];
    this.stream = new EventEmitter();
    this.clientEncoding = 'utf8';
    this._resetSequenceId = () => {};
    this.config = {
      localInfile: true,
      clientFlags: ClientConstants.LOCAL_FILES,
      ...config,
    };
  }

  writePacket(packet) {
    this.packets.push(packet);
  }
}

function payload(packet) {
  return packet.buffer.slice(packet.start + 4, packet.end).toString();
}

const directStream = new PassThrough();
let factoryCalled = false;
const query = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: directStream,
    infileStreamFactory() {
      factoryCalled = true;
      return new PassThrough();
    },
  },
  () => {}
);
const connection = new FakeConnection();
const next = query._streamLocalInfile(connection, '/etc/passwd');
assert.equal(next, query.infileOk);
assert.equal(factoryCalled, false);
directStream.write('1,2,3\n');
directStream.write('4,5');
directStream.end(',6\n');
assert.equal(payload(connection.packets[0]), '1,2,3\n');
assert.equal(payload(connection.packets[1]), '4,5');
assert.equal(payload(connection.packets[2]), ',6\n');

let seenPath;
const fallback = new Query(
  { sql: "LOAD DATA LOCAL INFILE 'requested.csv' INTO TABLE t" },
  () => {}
);
let fallbackStream;
const fallbackConnection = new FakeConnection({
  infileStreamFactory(path) {
    seenPath = path;
    fallbackStream = new PassThrough();
    return fallbackStream;
  },
});
fallback._streamLocalInfile(fallbackConnection, 'requested.csv');
fallbackStream.end('7,fallback\n');
assert.equal(seenPath, 'requested.csv');
assert.equal(payload(fallbackConnection.packets[0]), '7,fallback\n');

process.nextTick(() => {
  assert.equal(connection.packets[connection.packets.length - 1].length(), 4);
  assert.equal(
    fallbackConnection.packets[fallbackConnection.packets.length - 1].length(),
    4
  );
  query._unpipeStream();
  fallback._unpipeStream();
});

const optedOut = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE 'x.csv' INTO TABLE t",
    infileStreamFactory: null,
  },
  () => {}
);
let optedOutCalled = false;
const optedOutConnection = new FakeConnection({
  infileStreamFactory() {
    optedOutCalled = true;
    return new PassThrough();
  },
});
optedOut._streamLocalInfile(optedOutConnection, 'x.csv');
assert.equal(optedOutCalled, false);
assert.equal(
  optedOut._localStreamError.message,
  'As a result of LOCAL INFILE command server wants to read x.csv file, but as of v2.0 you must provide streamFactory option returning ReadStream.'
);

const blockedStream = new PassThrough();
const blocked = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: blockedStream,
    infileStreamFactory() {
      throw new Error('factory must not run when local infile is disabled');
    },
  },
  () => {}
);
const blockedConnection = new FakeConnection({
  localInfile: false,
  clientFlags: 0,
});
blocked._streamLocalInfile(blockedConnection, '/etc/passwd');
assert.equal(blocked._localStreamError.message, LOCAL_INFILE_DISABLED_MESSAGE);
assert.equal(blockedConnection.packets.length, 1);
assert.equal(blockedConnection.packets[0].length(), 4);
assert.equal(blockedStream.readableLength, 0);

assert.throws(
  () =>
    new Query(
      {
        sql: 'LOAD DATA LOCAL INFILE "x"',
        infileStream: Buffer.from('nope'),
      },
      () => {}
    ),
  (err) =>
    err instanceof TypeError &&
    err.message === 'infileStream must be a Readable stream'
);

const unrelated = new Error('command not allowed');
unrelated.errno = 1148;
unrelated.sqlMessage = unrelated.message;
rewriteLocalInfileError(unrelated, blockedConnection, 'SELECT 1');
assert.equal(unrelated.message, 'command not allowed');

const localErr = new Error('Loading local data is disabled');
localErr.errno = 3948;
localErr.sqlMessage = localErr.message;
rewriteLocalInfileError(
  localErr,
  blockedConnection,
  "LOAD DATA LOCAL INFILE 'x' INTO TABLE t"
);
assert.equal(localErr.message, LOCAL_INFILE_DISABLED_MESSAGE);

class LocalQuery extends Command {
  constructor(sql, cb) {
    super();
    this.sql = sql;
    this.onResult = cb;
  }

  start() {
    return this.start;
  }
}

const packet = Packets.Error.toPacket(
  {
    code: 1148,
    message: 'The used command is not allowed with this MySQL version',
  },
  'utf8'
);
packet.offset = packet.start + 4;
let commandError;
const command = new LocalQuery(
  "LOAD DATA LOCAL INFILE 'x' INTO TABLE t",
  (err) => {
    commandError = err;
  }
);
command.execute(packet, blockedConnection);
assert.equal(commandError.message, LOCAL_INFILE_DISABLED_MESSAGE);
assert.equal(commandError.errno, 1148);

const Execute = require('../../../lib/commands/execute.js');
const executeFactory = () => new PassThrough();
const execute = new Execute(
  {
    statement: { id: 1 },
    sql: "LOAD DATA LOCAL INFILE 'a.csv' INTO TABLE t",
    values: [],
    infileStreamFactory: executeFactory,
  },
  () => {}
);
assert.equal(execute._streamFactory, executeFactory);
assert.equal(execute._infileStream, null);
