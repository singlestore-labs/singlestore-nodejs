'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { assert } = require('poku');

const Command = require('../../../lib/commands/command.js');
const Query = require('../../../lib/commands/query.js');
const Packets = require('../../../lib/packets/index.js');
const ClientConstants = require('../../../lib/constants/client.js');
const {
  INFILE_STREAM_DESTROYED_MESSAGE,
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

const guardLeakStream = new PassThrough();
const guardLeakQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: guardLeakStream,
  },
  () => {}
);
assert.ok(guardLeakQuery._infileStreamEarlyGuard);
const serverErrPacket = Packets.Error.toPacket(
  { code: 1064, message: 'syntax error' },
  'utf8'
);
serverErrPacket.offset = serverErrPacket.start + 4;
const guardLeakConnection = new FakeConnection();
const guardLeakDone = guardLeakQuery.execute(
  serverErrPacket,
  guardLeakConnection
);
assert.equal(guardLeakDone, true);
assert.equal(guardLeakQuery._infileStreamEarlyGuard, null);
assert.equal(guardLeakStream.listenerCount('error'), 0);
assert.equal(guardLeakStream.listenerCount('close'), 0);

const earlyWireStream = new PassThrough();
const earlyWireQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: earlyWireStream,
  },
  () => {}
);
earlyWireStream.destroy(new Error('before server asks'));
process.nextTick(() => {
  assert.equal(earlyWireQuery._localStreamError.message, 'before server asks');
});

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

// Readable.from() emits string chunks (same as docs); objectMode PassThrough does too.
const stringStream = new PassThrough({ objectMode: true });
const stringQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: stringStream,
  },
  () => {}
);
const stringConnection = new FakeConnection();
stringQuery._streamLocalInfile(stringConnection, ':stream:');
stringStream.write('31,From Memory\n');
stringStream.write('32,Still');
stringStream.end(' Memory\n');
assert.equal(payload(stringConnection.packets[0]), '31,From Memory\n');
assert.equal(payload(stringConnection.packets[1]), '32,Still');
assert.equal(payload(stringConnection.packets[2]), ' Memory\n');
stringQuery._unpipeStream();

const preEndedStream = new PassThrough();
const preEndedQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: preEndedStream,
  },
  () => {}
);
const preEndedConnection = new FakeConnection();
preEndedStream.on('data', () => {});
preEndedStream.end('77,PreEnded\n');
process.nextTick(() => {
  assert.equal(preEndedStream.readableEnded, true);
  preEndedQuery._streamLocalInfile(preEndedConnection, ':stream:');
  assert.equal(preEndedConnection.packets.length, 1);
  assert.equal(preEndedConnection.packets[0].length(), 4);
  preEndedQuery._unpipeStream();
});

const earlyWireAtUploadStream = new PassThrough();
earlyWireAtUploadStream.on('error', () => {});
earlyWireAtUploadStream.destroy(new Error('failed while waiting'));
const earlyWireAtUploadQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: earlyWireAtUploadStream,
  },
  () => {}
);
const earlyWireAtUploadConnection = new FakeConnection();
earlyWireAtUploadQuery._streamLocalInfile(
  earlyWireAtUploadConnection,
  ':stream:'
);
assert.equal(
  earlyWireAtUploadQuery._localStreamError.message,
  'failed while waiting'
);
assert.equal(earlyWireAtUploadConnection.packets.length, 1);

const destroyedInfileStream = new PassThrough();
destroyedInfileStream.on('error', () => {});
destroyedInfileStream.destroy();
const destroyedInfileQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: destroyedInfileStream,
  },
  () => {}
);
const destroyedInfileConnection = new FakeConnection();
destroyedInfileQuery._streamLocalInfile(destroyedInfileConnection, ':stream:');
assert.equal(
  destroyedInfileQuery._localStreamError.message,
  INFILE_STREAM_DESTROYED_MESSAGE
);
assert.equal(destroyedInfileConnection.packets.length, 1);
destroyedInfileQuery._unpipeStream();

const erroredInfileStream = new PassThrough();
erroredInfileStream.on('error', () => {});
erroredInfileStream.destroy(new Error('read failed'));
const erroredInfileQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: erroredInfileStream,
  },
  () => {}
);
const erroredInfileConnection = new FakeConnection();
erroredInfileQuery._streamLocalInfile(erroredInfileConnection, ':stream:');
assert.equal(erroredInfileQuery._localStreamError.message, 'read failed');
assert.equal(erroredInfileConnection.packets.length, 1);
assert.equal(erroredInfileConnection.packets[0].length(), 4);
erroredInfileQuery._unpipeStream();

const factoryDestroyedStream = new PassThrough();
factoryDestroyedStream.on('error', () => {});
factoryDestroyedStream.destroy();
const factoryDestroyedQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE 'from-factory.csv' INTO TABLE t",
    infileStreamFactory() {
      return factoryDestroyedStream;
    },
  },
  () => {}
);
const factoryDestroyedConnection = new FakeConnection();
factoryDestroyedQuery._streamLocalInfile(
  factoryDestroyedConnection,
  'from-factory.csv'
);
assert.equal(
  factoryDestroyedQuery._localStreamError.message,
  INFILE_STREAM_DESTROYED_MESSAGE
);
assert.equal(factoryDestroyedConnection.packets.length, 1);
assert.equal(factoryDestroyedConnection.packets[0].length(), 4);

const bufferedEndStream = new PassThrough();
bufferedEndStream.pause();
bufferedEndStream.end('88,Buffered\n');
const bufferedEndQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: bufferedEndStream,
  },
  () => {}
);
const bufferedEndConnection = new FakeConnection();
bufferedEndQuery._streamLocalInfile(bufferedEndConnection, ':stream:');
assert.equal(payload(bufferedEndConnection.packets[0]), '88,Buffered\n');
process.nextTick(() => {
  assert.equal(bufferedEndConnection.packets.length, 2);
  assert.equal(
    bufferedEndConnection.packets[
      bufferedEndConnection.packets.length - 1
    ].length(),
    4
  );
  bufferedEndQuery._unpipeStream();
});

const emptyChunkStream = new PassThrough();
const emptyChunkQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: emptyChunkStream,
  },
  () => {}
);
const emptyChunkConnection = new FakeConnection();
emptyChunkQuery._streamLocalInfile(emptyChunkConnection, ':stream:');
emptyChunkStream.write('');
emptyChunkStream.write('after-empty\n');
emptyChunkStream.end();
assert.equal(emptyChunkConnection.packets.length, 1);
assert.equal(payload(emptyChunkConnection.packets[0]), 'after-empty\n');
process.nextTick(() => {
  assert.equal(emptyChunkConnection.packets.length, 2);
  assert.equal(
    emptyChunkConnection.packets[
      emptyChunkConnection.packets.length - 1
    ].length(),
    4
  );
  emptyChunkQuery._unpipeStream();
});

const badChunkStream = new PassThrough({ objectMode: true });
const badChunkQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: badChunkStream,
  },
  () => {}
);
const badChunkConnection = new FakeConnection();
badChunkQuery._streamLocalInfile(badChunkConnection, ':stream:');
badChunkStream.write(42);
assert.equal(
  badChunkQuery._localStreamError.message,
  'LOCAL INFILE stream must emit Buffer or string chunks'
);
assert.equal(badChunkConnection.packets.length, 1);
assert.equal(badChunkConnection.packets[0].length(), 4);
badChunkStream.emit('error', new Error('late stream failure'));
assert.equal(badChunkConnection.packets.length, 1);
badChunkStream.end();
badChunkQuery._unpipeStream();

const bufferedBadStream = new PassThrough({ objectMode: true });
bufferedBadStream.pause();
bufferedBadStream.write(42);
bufferedBadStream.write('99,AfterBad\n');
const bufferedBadQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: bufferedBadStream,
  },
  () => {}
);
const bufferedBadConnection = new FakeConnection();
bufferedBadQuery._streamLocalInfile(bufferedBadConnection, ':stream:');
assert.equal(
  bufferedBadQuery._localStreamError.message,
  'LOCAL INFILE stream must emit Buffer or string chunks'
);
assert.equal(bufferedBadConnection.packets.length, 1);
bufferedBadStream.write('more,Data\n');
assert.equal(bufferedBadConnection.packets.length, 1);
bufferedBadQuery._unpipeStream();

const pendingCloseStream = new PassThrough({ objectMode: true });
pendingCloseStream._closed = false;
Object.defineProperty(pendingCloseStream, 'closed', {
  get() {
    return pendingCloseStream._closed;
  },
  configurable: true,
});
Object.defineProperty(pendingCloseStream, 'destroyed', {
  value: true,
  configurable: true,
});
const pendingCloseQuery = new Query(
  {
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    infileStream: pendingCloseStream,
  },
  () => {}
);
const pendingCloseConnection = new FakeConnection();
pendingCloseQuery._streamLocalInfile(pendingCloseConnection, ':stream:');
pendingCloseStream.write(42);
process.nextTick(() => {
  pendingCloseStream.emit('error', new Error('pending destroy error'));
  assert.equal(pendingCloseConnection.packets.length, 1);
  pendingCloseStream._closed = true;
  pendingCloseStream.emit('close');
});

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
assert.equal(Execute.prototype.infileOk, Query.prototype.infileOk);

const executeStream = new PassThrough();
const executeInfile = new Execute(
  {
    statement: { id: 1 },
    sql: "LOAD DATA LOCAL INFILE ':stream:' INTO TABLE t",
    values: [],
    infileStream: executeStream,
  },
  () => {}
);
const executeConn = new FakeConnection();
const executeNext = executeInfile._streamLocalInfile(executeConn, ':stream:');
assert.equal(
  executeNext,
  Execute.prototype.infileOk,
  'Execute must stay on infileOk until server OK after LOCAL INFILE upload'
);
executeStream.end();
executeInfile._unpipeStream();
