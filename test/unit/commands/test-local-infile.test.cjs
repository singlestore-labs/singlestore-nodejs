'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough, Readable } = require('node:stream');
const process = require('node:process');
const { assert } = require('poku');

const Query = require('../../../lib/commands/query.js');
const Execute = require('../../../lib/commands/execute.js');
const ClientConstants = require('../../../lib/constants/client.js');
const Packets = require('../../../lib/packets/index.js');

class FakeConnection extends EventEmitter {
  constructor(config) {
    super();
    this.packets = [];
    this.stream = new EventEmitter();
    this.clientEncoding = 'utf8';
    this.serverEncoding = 'utf8';
    // Needed to parse the server's OK packet in infileOk().
    this._handshakePacket = { capabilityFlags: ClientConstants.PROTOCOL_41 };
    this.config = {
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

function isEof(packet) {
  return packet.length() === 4;
}

function load(options, connection = new FakeConnection(), path = 'x.csv') {
  const query = new Query(
    { sql: "LOAD DATA LOCAL INFILE 'x.csv' INTO TABLE t", ...options },
    () => {}
  );
  const next = query._streamLocalInfile(connection, path);
  assert.equal(next, query.infileOk);
  return { query, connection };
}

// Buffer chunks from a factory stream are forwarded as-is.
{
  const stream = new PassThrough();
  const { connection } = load({ infileStreamFactory: () => stream });
  stream.write('1,2,3\n');
  stream.write('4,5');
  stream.end(',6\n');
  assert.equal(payload(connection.packets[0]), '1,2,3\n');
  assert.equal(payload(connection.packets[1]), '4,5');
  assert.equal(payload(connection.packets[2]), ',6\n');
  process.nextTick(() => {
    assert.equal(connection.packets.length, 4);
    assert.ok(isEof(connection.packets[3]));
  });
}

// Readable.from() emits string chunks; these used to crash with
// "data.copy is not a function". Multi-byte characters must be sent as bytes.
{
  const { connection } = load({
    infileStreamFactory: () => Readable.from(['31,From Memory\n', '32,Café\n']),
  });
  setImmediate(() => {
    assert.equal(payload(connection.packets[0]), '31,From Memory\n');
    assert.equal(payload(connection.packets[1]), '32,Café\n');
    assert.equal(
      connection.packets[1].length() - 4,
      Buffer.byteLength('32,Café\n')
    );
    assert.ok(isEof(connection.packets[2]));
    assert.equal(connection.packets.length, 3);
  });
}

// Empty chunks are skipped instead of being sent as a premature EOF packet.
{
  const stream = new PassThrough({ objectMode: true });
  const { connection } = load({ infileStreamFactory: () => stream });
  stream.write('');
  stream.write('after-empty\n');
  stream.end();
  assert.equal(connection.packets.length, 1);
  assert.equal(payload(connection.packets[0]), 'after-empty\n');
  process.nextTick(() => {
    assert.equal(connection.packets.length, 2);
    assert.ok(isEof(connection.packets[1]));
  });
}

// Uint8Array chunks (not Buffers) are accepted, including views with an offset.
{
  const stream = new PassThrough({ objectMode: true });
  const { connection } = load({ infileStreamFactory: () => stream });
  stream.write(new TextEncoder().encode('41,Uint8\n'));
  const backing = new TextEncoder().encode('xx42,Offset\nyy');
  stream.write(new Uint8Array(backing.buffer, 2, backing.length - 4));
  stream.end();
  assert.equal(payload(connection.packets[0]), '41,Uint8\n');
  assert.equal(payload(connection.packets[1]), '42,Offset\n');
  process.nextTick(() => {
    assert.equal(connection.packets.length, 3);
    assert.ok(isEof(connection.packets[2]));
  });
}

// Other chunk types fail the load with one EOF and destroy the stream.
{
  const stream = new PassThrough({ objectMode: true });
  const { query, connection } = load({ infileStreamFactory: () => stream });
  stream.write(42);
  assert.equal(
    query._localStreamError.message,
    'LOCAL INFILE stream must emit Buffer, Uint8Array or string chunks'
  );
  assert.equal(connection.packets.length, 1);
  assert.ok(isEof(connection.packets[0]));
  assert.equal(stream.destroyed, true);
  assert.equal(stream.listenerCount('data'), 0);
}

// An error after end must not send a second EOF packet.
{
  const stream = new PassThrough();
  const { query, connection } = load({ infileStreamFactory: () => stream });
  stream.emit('end');
  stream.emit('error', new Error('late failure'));
  assert.equal(connection.packets.length, 1);
  assert.equal(query._localStreamError.message, 'late failure');
}

// Only the first stream error is reported, with one EOF.
{
  const stream = new PassThrough();
  const { query, connection } = load({ infileStreamFactory: () => stream });
  stream.emit('error', new Error('first'));
  stream.emit('error', new Error('second'));
  assert.equal(connection.packets.length, 1);
  assert.equal(query._localStreamError.message, 'first');
}

// _unpipeStream also removes the connection error listener.
{
  const stream = new PassThrough();
  const { query, connection } = load({ infileStreamFactory: () => stream });
  assert.equal(connection.listenerCount('error'), 1);
  query._unpipeStream();
  assert.equal(connection.listenerCount('error'), 0);
  assert.equal(stream.listenerCount('data'), 0);
}

// Falls back to the connection-level factory and passes the requested path.
{
  let seenPath;
  let stream;
  const connection = new FakeConnection({
    infileStreamFactory(path) {
      seenPath = path;
      stream = new PassThrough();
      return stream;
    },
  });
  load({}, connection, 'requested.csv');
  stream.end('7,fallback\n');
  assert.equal(seenPath, 'requested.csv');
  assert.equal(payload(connection.packets[0]), '7,fallback\n');
}

// An explicit null per-query factory opts out of the connection factory.
{
  let called = false;
  const connection = new FakeConnection({
    infileStreamFactory() {
      called = true;
      return new PassThrough();
    },
  });
  const { query } = load({ infileStreamFactory: null }, connection);
  assert.equal(called, false);
  assert.equal(
    query._localStreamError.message,
    'Server requested local file x.csv for LOAD DATA LOCAL INFILE, but no infileStreamFactory option was provided.'
  );
  assert.equal(connection.packets.length, 1);
}

// With LOCAL_FILES cleared (flags: '-LOCAL_FILES') the client refuses the
// upload even if the server asks, and never calls the factory.
{
  const connection = new FakeConnection({ clientFlags: 0 });
  const { query } = load(
    {
      infileStreamFactory() {
        throw new Error('factory must not run when LOCAL_FILES is off');
      },
    },
    connection,
    '/etc/passwd'
  );
  assert.equal(query._localStreamError.code, 'ER_CLIENT_LOCAL_FILES_DISABLED');
  assert.equal(query._localStreamError.errno, undefined);
  assert.equal(connection.packets.length, 1);
  assert.ok(isEof(connection.packets[0]));
}

// Execute waits for the server OK after the upload (infileOk), like Query.
{
  const stream = new PassThrough();
  const execute = new Execute(
    {
      statement: { id: 1 },
      sql: "LOAD DATA LOCAL INFILE 'a.csv' INTO TABLE t",
      values: [],
      infileStreamFactory: () => stream,
    },
    () => {}
  );
  const next = execute._streamLocalInfile(new FakeConnection(), 'a.csv');
  assert.equal(typeof next, 'function');
  assert.equal(next, Query.prototype.infileOk);
  execute._unpipeStream();
}

// With a query timeout, a failed upload must call the callback exactly once:
// the timer is cleared when the stream error is reported, and if the timer
// already fired, the later server OK does not complete the query again.
function okPacket() {
  const packet = Packets.OK.toPacket({ affectedRows: 0 }, 'utf8');
  packet.offset = packet.start + 4;
  return packet;
}

function loadWithTimeout(options, connection, timeout) {
  const calls = [];
  const query = new Query(
    { sql: "LOAD DATA LOCAL INFILE 'x.csv' INTO TABLE t", timeout, ...options },
    (err) => calls.push(err)
  );
  query._setTimeout(); // what start() does
  query._streamLocalInfile(connection, 'x.csv');
  return { query, calls };
}

// LOCAL_FILES refusal, then server OK: one callback, no timeout afterwards.
{
  const connection = new FakeConnection({ clientFlags: 0 });
  const { query, calls } = loadWithTimeout({}, connection, 20);
  query.infileOk(okPacket(), connection);
  assert.equal(query.queryTimeout, null);
  setTimeout(() => {
    assert.equal(calls.length, 1, 'callback must run once');
    assert.equal(calls[0].code, 'ER_CLIENT_LOCAL_FILES_DISABLED');
  }, 60);
}

// Invalid chunk, then server OK: one callback, no timeout afterwards.
{
  const stream = new PassThrough({ objectMode: true });
  const connection = new FakeConnection();
  const { query, calls } = loadWithTimeout(
    { infileStreamFactory: () => stream },
    connection,
    20
  );
  stream.write(42);
  query.infileOk(okPacket(), connection);
  setTimeout(() => {
    assert.equal(calls.length, 1, 'callback must run once');
    assert.equal(
      calls[0].message,
      'LOCAL INFILE stream must emit Buffer, Uint8Array or string chunks'
    );
  }, 60);
}

// Timeout fires before the server OK: the late OK must not call back again.
{
  const connection = new FakeConnection({ clientFlags: 0 });
  const { query, calls } = loadWithTimeout({}, connection, 10);
  setTimeout(() => {
    assert.equal(calls.length, 1);
    assert.equal(calls[0].code, 'PROTOCOL_SEQUENCE_TIMEOUT');
    query.infileOk(okPacket(), connection);
    assert.equal(calls.length, 1, 'late server OK must not call back again');
  }, 40);
}
