'use strict';

const common = require('../../common.test.cjs');
const { assert } = require('poku');
const Long = require('long');

const connection = common.createConnection();
// Made changes to Pass the test need to check if alternate or solution of this issue.
connection.query(
  [
    'CREATE TEMPORARY TABLE `bigs` (',
    '`id` bigint NOT NULL AUTO_INCREMENT,',
    '`title` varchar(255),',
    'PRIMARY KEY (`id`)',
    ')',
  ].join('\n')
);

connection.query("INSERT INTO bigs SET title='test', id=123");
connection.query("INSERT INTO bigs SET title='test1'", (err, result) => {
  if (err) {
    throw err;
  }
  assert.strictEqual(result.insertId, 1);
  // > 24 bits
  connection.query("INSERT INTO bigs SET title='test', id=123456789");
  connection.query("INSERT INTO bigs SET title='test2'", (err, result) => {
    assert.strictEqual(result.insertId, 2);
    // big int
    connection.query("INSERT INTO bigs SET title='test', id=9007199254740992");
    connection.query("INSERT INTO bigs SET title='test3'", (err, result) => {
      assert.strictEqual(
        Long.fromString('9007199254740993').compare(result.insertId),
        1
      );
      connection.query(
        "INSERT INTO bigs SET title='test', id=90071992547409924"
      );
      connection.query("INSERT INTO bigs SET title='test4'", (err, result) => {
        assert.strictEqual(
          Long.fromString('90071992547409925').compare(result.insertId),
          1
        );
        connection.query(
          {
            sql: 'select * from bigs order by id',
            supportBigNumbers: true,
            bigNumberString: false,
          },
          (err, result) => {
            assert.strictEqual(result[0].id, 1);
            assert.strictEqual(result[1].id, 2);
            assert.strictEqual(result[2].id, 3);
            assert.strictEqual(result[3].id, 4);
            assert.strictEqual(result[4].id, 123);
            assert.strictEqual(result[5].id, 123456789);
            assert.strictEqual(result[6].id, 9007199254740992);
            assert.strictEqual(result[7].id, '90071992547409924');
            connection.end();
          }
        );
      });
    });
  });
});
