'use strict';

const LOCAL_INFILE_DISABLED_MESSAGE =
  'Local infile is disabled by connector. Enable `local_infile` to allow local infile commands';

const LOCAL_INFILE_DISABLED_ERRNOS = new Set([1148, 3948, 4166]);

const INFILE_STREAM_DESTROYED_MESSAGE =
  'infileStream was destroyed before upload completed';

function infileStreamDestroyAbortError() {
  return new Error(INFILE_STREAM_DESTROYED_MESSAGE);
}

function captureInfileStreamAbort(command, stream) {
  if (
    !command._localStreamError &&
    stream &&
    stream.destroyed &&
    !stream.readableEnded &&
    !stream.errored
  ) {
    command._localStreamError = infileStreamDestroyAbortError();
  }
}

function localInfileAllowed(connection) {
  return (
    !connection || !connection.config || connection.config.localInfile !== false
  );
}

function localInfileDisabledError() {
  const err = new Error(LOCAL_INFILE_DISABLED_MESSAGE);
  err.code = 'ER_CLIENT_LOCAL_FILES_DISABLED';
  err.errno = 3948;
  return err;
}

function attachInfileStreamErrorGuard(command) {
  const stream = command._infileStream;
  if (!stream || command._infileStreamEarlyGuard) {
    return;
  }
  const onEarlyError = (err) => {
    if (!command._localStreamError) {
      command._localStreamError = err;
    }
  };
  const onEarlyClose = () => {
    captureInfileStreamAbort(command, stream);
  };
  command._infileStreamEarlyGuard = { onEarlyError, onEarlyClose };
  stream.on('error', onEarlyError);
  stream.on('close', onEarlyClose);
  if (stream.errored) {
    onEarlyError(stream.errored);
  }
  captureInfileStreamAbort(command, stream);
}

function detachInfileStreamErrorGuard(command) {
  const stream = command._infileStream;
  const guard = command._infileStreamEarlyGuard;
  if (stream && guard) {
    stream.removeListener('error', guard.onEarlyError);
    stream.removeListener('close', guard.onEarlyClose);
  }
  command._infileStreamEarlyGuard = null;
}

function assignLocalInfileOptions(command, options) {
  const source = options || {};
  command._streamFactory = source.infileStreamFactory;
  command._infileStream = null;
  if (source.infileStream !== undefined && source.infileStream !== null) {
    if (
      typeof source.infileStream.read !== 'function' ||
      typeof source.infileStream.on !== 'function'
    ) {
      throw new TypeError('infileStream must be a Readable stream');
    }
    command._infileStream = source.infileStream;
    attachInfileStreamErrorGuard(command);
  }
}

function rewriteLocalInfileError(err, connection, sql) {
  if (!err || localInfileAllowed(connection)) {
    return err;
  }
  if (!LOCAL_INFILE_DISABLED_ERRNOS.has(err.errno)) {
    return err;
  }
  // 1148 is a generic "command not allowed" code. Only rewrite it for LOCAL INFILE.
  if (
    err.errno === 1148 &&
    !/load\s+(data\s+)?local\s+infile/i.test(sql || '')
  ) {
    return err;
  }
  err.message = LOCAL_INFILE_DISABLED_MESSAGE;
  err.sqlMessage = LOCAL_INFILE_DISABLED_MESSAGE;
  return err;
}

module.exports = {
  LOCAL_INFILE_DISABLED_MESSAGE,
  INFILE_STREAM_DESTROYED_MESSAGE,
  assignLocalInfileOptions,
  attachInfileStreamErrorGuard,
  captureInfileStreamAbort,
  detachInfileStreamErrorGuard,
  infileStreamDestroyAbortError,
  localInfileAllowed,
  localInfileDisabledError,
  rewriteLocalInfileError,
};
