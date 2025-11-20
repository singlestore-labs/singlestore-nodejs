'use strict';

const common = require('../../common.test.cjs');
const { assert } = require('poku');

const connection = common.createConnection({
  supportBigNumbers: true,
  bigNumberStrings: true,
});

connection.query(
  [
    'CREATE TEMPORARY TABLE `bigs` (',
    '`id` bigint NOT NULL,',
    '`title` varchar(255),',
    'PRIMARY KEY (`id`)',
    ')',
  ].join('\n')
);

// Insert test data with explicit IDs to match the expected assertions
connection.query("INSERT INTO bigs SET title='test1', id=123", (err) => {
  if (err) throw err;
  
  connection.query("INSERT INTO bigs SET title='test2', id=124", (err) => {
    if (err) throw err;
    
    connection.query("INSERT INTO bigs SET title='test3', id=123456789", (err) => {
      if (err) throw err;
      
      connection.query("INSERT INTO bigs SET title='test4', id=123456790", (err) => {
        if (err) throw err;
        
        connection.query("INSERT INTO bigs SET title='test5', id=9007199254740992", (err) => {
          if (err) throw err;
          
          connection.query("INSERT INTO bigs SET title='test6', id=9007199254740993", (err) => {
            if (err) throw err;
            
            connection.query("INSERT INTO bigs SET title='test7', id=90071992547409924", (err) => {
              if (err) throw err;
              
              connection.query("INSERT INTO bigs SET title='test8', id=90071992547409925", (err) => {
                if (err) throw err;
                
                connection.query('SELECT * FROM bigs ORDER BY id', (err, result) => {
                  if (err) throw err;
                  
                  // Use the exact assertions you specified
                  assert.strictEqual(result[0].id, '123');
                  assert.strictEqual(result[1].id, '124');
                  assert.strictEqual(result[2].id, '123456789');
                  assert.strictEqual(result[3].id, '123456790');
                  assert.strictEqual(result[4].id, '9007199254740992');
                  assert.strictEqual(result[5].id, '9007199254740993');
                  assert.strictEqual(result[6].id, '90071992547409924');
                  assert.strictEqual(result[7].id, '90071992547409925');
                  
                  connection.end();
                });
              });
            });
          });
        });
      });
    });
  });
});
