'use strict';

const common = require('../../common.test.cjs');
const connection = common.createConnection();
const { assert } = require('poku');
const process = require('node:process');

// test data stores
const testData = [
  { id: 1, text: 'ютф восемь' },
  { id: 2, text: 'Experimental' },
  { id: 3, text: 'परीक्षण' },
  { id: 4, text: 'test тест テスト փորձաsրկում পরীক্ষা kiểm tra' },
  { id: 5, text: 'ტესტი પરીક્ષણ  מבחן פּרובירן اختبار' },
];

let resultData = null;

// test inserting of non latin data if we are able to parse it
const testEncoding = function (err) {
  assert.ifError(err);

  testData.forEach((data) => {
    connection.query(
      'INSERT INTO `test-charset-encoding` (id, field) VALUES (?, ?)',
      [data.id, data.text],
      (err2) => {
        assert.ifError(err2);
      }
    );
  });

  connection.query(
    'SELECT * from `test-charset-encoding` ORDER BY id',
    (err, results) => {
      assert.ifError(err);
      resultData = results;
    }
  );
  connection.end();
};

// init test sequence
(function () {
  connection.query('DROP TABLE IF EXISTS `test-charset-encoding`', () => {
    connection.query(
      'CREATE TABLE IF NOT EXISTS `test-charset-encoding` ' +
        '( `id` INT PRIMARY KEY, `field` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci)',
      (err) => {
        assert.ifError(err);
        connection.query('DELETE from `test-charset-encoding`', testEncoding);
      }
    );
  });
})();

process.on('exit', () => {
  resultData.forEach((data, index) => {
    assert.equal(data.field, testData[index].text);
  });
});
