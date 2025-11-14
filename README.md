# SingleStore Node.js Driver

> SingleStore client for Node.js with focus on performance. Supports prepared statements, distributed queries, real-time analytics, compression, ssl and much more.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Linux Build][travis-image]][travis-url]

## Table of Contents

- [History and Why SingleStore Node.js Driver](#history-and-why-singlestore-nodejs-driver)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Documentation](#documentation)
- [Connection Options](#connection-options)
- [SingleStore-Specific Features](#singlestore-specific-features)
- [Migration from MySQL2](#migration-from-mysql2)

## History and Why SingleStore Node.js Driver

The SingleStore Node.js Driver is a fork of MySQL2, adapted specifically for SingleStore database. Since SingleStore is MySQL wire-protocol compatible, most MySQL2 features work seamlessly, with additional optimizations for SingleStore's distributed architecture and analytics capabilities.

This driver offers these features optimized for SingleStore:

- **Faster / Better Performance** for distributed queries
- **Connection routing** to appropriate nodes (aggregator/leaf)
- **Support for ColumnStore and RowStore** tables
- **Real-time analytics** optimizations
- **Distributed query execution** handling
- **Pipeline data ingestion** support
- **Optimized batch inserts** for high-throughput scenarios
- All existing MySQL2 features (Prepared Statements, Pooling, etc.)

## Installation

```bash
npm install singlestore-nodejs
```

## Quick Start

```javascript
const singlestore = require('singlestore_nodejs');

// Create connection
const connection = singlestore.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  port: 3306
});

// Simple query
connection.query('SELECT * FROM users', (err, results, fields) => {
  if (err) throw err;
  console.log(results);
});

// Using promises
connection.promise().query('SELECT * FROM products')
  .then(([rows, fields]) => {
    console.log(rows);
  })
  .catch(console.error);

// Close connection
connection.end();
```

## Features

- **High Performance**: Optimized for SingleStore's distributed architecture
- **Prepared Statements**: Binary protocol with prepared statements
- **Connection Pooling**: Built-in connection pool management
- **Promise Wrapper**: Native promise support
- **Compression**: Protocol compression support
- **SSL/TLS**: Secure connections
- **Transaction Support**: Full transaction support
- **Streaming**: Stream large result sets
- **TypeScript**: Full TypeScript definitions included

## Connection Options

SingleStore Node.js Driver accepts all standard connection options plus SingleStore-specific options:

```javascript
const connection = singlestore.createConnection({
  // Standard options
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'mydb',
  
  // SingleStore-specific options
  enablePipeline: true,          // Enable pipeline support
  preferAggregator: true,        // Prefer aggregator nodes for queries
  distributedQuery: true,        // Enable distributed query optimizations
  columnstoreOptimized: true,    // Optimize for columnstore tables
  
  // Performance options
  multipleStatements: true,
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true
});
```

## SingleStore-Specific Features

### Pipeline Support

SingleStore pipelines allow for high-throughput data ingestion:

```javascript
// Create a pipeline
connection.query(
  `CREATE PIPELINE my_pipeline AS 
   LOAD DATA S3 'bucket/path' 
   INTO TABLE my_table`,
  (err) => {
    if (err) throw err;
    // Start the pipeline
    connection.query('START PIPELINE my_pipeline');
  }
);
```

### Batch Inserts Optimization

Optimized batch inserts for high-throughput scenarios:

```javascript
const values = [
  [1, 'John', 'john@example.com'],
  [2, 'Jane', 'jane@example.com'],
  // ... thousands more rows
];

connection.query(
  'INSERT INTO users (id, name, email) VALUES ?',
  [values],
  (err, result) => {
    if (err) throw err;
    console.log(`Inserted ${result.affectedRows} rows`);
  }
);
```

### Distributed Queries

SingleStore Node.js Driver handles distributed queries efficiently:

```javascript
// Query automatically routed to appropriate nodes
connection.query(
  'SELECT COUNT(*) FROM large_table WHERE date > ?',
  [new Date('2024-01-01')],
  (err, results) => {
    if (err) throw err;
    console.log(results);
  }
);
```

## Migration from MySQL2

SingleStore Node.js Driver is API-compatible with MySQL2, so migration is straightforward:

```javascript
// Before (MySQL2)
const mysql = require('mysql2');
const connection = mysql.createConnection({...});

// After (SingleStore Node.js Driver)
const singlestore = require('singlestore_nodejs');
const connection = singlestore.createConnection({...});

// All existing queries work as-is!
```

## Documentation

- [Connection Options](documentation/Connection-Options.md)
- [Prepared Statements](documentation/Prepared-Statements.md)
- [Connection Pooling](documentation/Connection-Pooling.md)
- [Promise Wrapper](documentation/Promise-Wrapper.md)
- [API Reference](documentation/API.md)
- [SingleStore Features](documentation/SingleStore-Features.md)

## Contributing

Contributions are welcome! Please see [Contributing.md](Contributing.md) for details.

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

This project is a fork of [mysql2](https://github.com/sidorares/node-mysql2) by @sidorares. We are grateful for the excellent foundation provided by the MySQL2 project.
