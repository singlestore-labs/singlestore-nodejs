'use strict';

const { Buffer } = require('node:buffer');

module.exports = async function () {
  // const mySQLVersion = await common.getMysqlVersion(connection);

  // mysql8 renamed some standard functions
  // see https://dev.mysql.com/doc/refman/8.0/en/gis-wkb-functions.html
  // const stPrefix = mySQLVersion.major >= 8 ? 'ST_' : '';

  return [
    { type: 'decimal(4,3)', insert: '1.234', columnType: 'NEWDECIMAL' },
    //  {type: 'decimal(3,3)', insert: 0.33},
    { type: 'tinyint', insert: 1, columnType: 'TINY' },
    { type: 'smallint', insert: 2, columnType: 'SHORT' },
    { type: 'int', insert: 3, columnType: 'LONG' },
    { type: 'float', insert: 4.5, columnType: 'FLOAT' },
    { type: 'double', insert: 5.5, columnType: 'DOUBLE' },
    { type: 'bigint', insert: '6', expect: 6, columnType: 'LONGLONG' },
    { type: 'bigint', insert: 6, columnType: 'LONGLONG' },
    { type: 'mediumint', insert: 7, columnType: 'INT24' },
    { type: 'year', insert: 2012, columnType: 'YEAR' },
    {
      type: 'timestamp',
      insert: new Date('2012-05-12 11:00:23'),
      columnType: 'TIMESTAMP',
    },
    {
      type: 'datetime',
      insert: new Date('2012-05-12 12:00:23'),
      columnType: 'DATETIME',
    },
    {
      type: 'date',
      insert: new Date('2012-05-12 00:00:00'),
      columnType: 'DATE',
    },
    { type: 'time', insert: '13:13:23', columnType: 'TIME' },
    { type: 'time', insert: '-13:13:23', columnType: 'TIME' },
    { type: 'time', insert: '413:13:23', columnType: 'TIME' },
    { type: 'time', insert: '-413:13:23', columnType: 'TIME' },
    {
      type: 'binary(4)',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'STRING',
    },
    {
      type: 'varbinary(4)',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'VAR_STRING',
    },
    {
      type: 'tinyblob',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'BLOB',
    },
    {
      type: 'mediumblob',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'BLOB',
    },
    {
      type: 'longblob',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'BLOB',
    },
    { type: 'blob', insert: Buffer.from([0, 1, 254, 255]), columnType: 'BLOB' },
    {
      type: 'bit(32)',
      insert: Buffer.from([0, 1, 254, 255]),
      columnType: 'BIT',
    },
    { type: 'char(5)', insert: 'Hello', columnType: 'STRING' },
    { type: 'varchar(5)', insert: 'Hello', columnType: 'VAR_STRING' },
    {
      type: 'varchar(3) character set utf8 collate utf8_bin',
      insert: 'bin',
      columnType: 'VAR_STRING',
    },
    { type: 'tinytext', insert: 'Hello World', columnType: 'BLOB' },
    { type: 'mediumtext', insert: 'Hello World', columnType: 'BLOB' },
    { type: 'longtext', insert: 'Hello World', columnType: 'BLOB' },
    { type: 'text', insert: 'Hello World', columnType: 'BLOB' },
  ];
};
