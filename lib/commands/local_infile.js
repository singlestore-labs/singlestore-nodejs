'use strict';

const LOCAL_INFILE_DISABLED_MESSAGE =
  'Local infile is disabled by connector. Enable `local_infile` to allow local infile commands';

const LOCAL_INFILE_DISABLED_ERRNOS = new Set([1148, 3948, 4166]);

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
  assignLocalInfileOptions,
  localInfileAllowed,
  localInfileDisabledError,
  rewriteLocalInfileError,
};
