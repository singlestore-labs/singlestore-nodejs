[npm-image]: https://img.shields.io/npm/v/mysql2.svg
[npm-url]: https://npmjs.com/package/mysql2
[node-version-image]: https://img.shields.io/node/v/mysql2.svg
[node-version-url]: https://nodejs.org/en/download
[downloads-image]: https://img.shields.io/npm/dm/mysql2.svg
[downloads-url]: https://npmjs.com/package/mysql2
[license-url]: https://github.com/sidorares/node-mysql2/blob/master/License
[license-image]: https://img.shields.io/npm/l/mysql2.svg?maxAge=2592000
[node-mysql]: https://github.com/mysqljs/mysql
[mysqljs]: https://github.com/mysqljs
[mysql-native]: https://github.com/sidorares/nodejs-mysql-native
[sidorares]: https://github.com/sidorares
[TooTallNate]: https://gist.github.com/TooTallNate
[starttls.js]: https://gist.github.com/TooTallNate/848444
[node-mariasql]: https://github.com/mscdex/node-mariasql
[contributors]: https://github.com/sidorares/node-mysql2/graphs/contributors
[contributing]: https://github.com/singlestore-labs/singlestore-nodejs/blob/master/Contributing.md
[docs-base]: https://singlestore-labs.github.io/singlestore-nodejs/docs
[docs-api]: https://singlestore-labs.github.io/singlestore-nodejs/docs/api-and-configurations
[docs-prepared-statements]: https://singlestore-labs.github.io/singlestore-nodejs/docs/documentation/prepared-statements
[docs-mysql-server]: https://singlestore-labs.github.io/singlestore-nodejs/docs/documentation/mysql-server
[docs-promise-wrapper]: https://singlestore-labs.github.io/singlestore-nodejs/documentation/promise-wrapper
[docs-authentication-switch]: https://singlestore-labs.github.io/singlestore-nodejs/docs/documentation/authentication-switch
[docs-streams]: https://sidorares.github.io/node-mysql2/docs/documentation/extras
[docs-typescript-docs]: https://sidorares.github.io/node-mysql2/docs/documentation/typescript-examples
[docs-qs-pooling]: https://singlestore-labs.github.io/singlestore-nodejs/docs#using-connection-pools
[docs-qs-first-query]: https://singlestore-labs.github.io/singlestore-nodejs/docs#first-query
[docs-qs-using-prepared-statements]: https://singlestore-labs.github.io/singlestore-nodejs/docs#using-prepared-statements
[docs-examples]: https://singlestore-labs.github.io/singlestore-nodejs/docs/examples
[docs-faq]: https://singlestore-labs.github.io/singlestore-nodejs/docs/faq
[docs-documentation]: https://singlestore-labs.github.io/singlestore-nodejs/docs/documentation
[docs-contributing]: https://singlestore-labs.github.io/singlestore-nodejs/docs/contributing
[tests-image]: https://github.com/singlestore-labs/singlestore-nodejs/actions/workflows/tests.yml/badge.svg?branch=master
[tests-url]: https://github.com/singlestore-labs/singlestore-nodejs/actions/workflows/tests.yml
[gh-pages-image]: https://github.com/singlestore-labs/singlestore-nodejs/actions/workflows/gh-pages.yml/badge.svg?branch=master
[gh-pages-url]: https://github.com/singlestore-labs/singlestore-nodejs/actions/workflows/gh-pages.yml

# SingleStore Node.js Driver

> SingleStore client for Node.js with focus on performance. Supports prepared statements, distributed queries, real-time analytics, compression, ssl and much more.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Tests][tests-image]][tests-url]
[![GitHub Pages][gh-pages-image]][gh-pages-url]
[![License][license-image]][license-url]

## Table of Contents

- [History and Why MySQL2](#history-and-why-mysql2)
- [Why SingleStore Node.js Driver](#why-singlestore-nodejs-driver)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Migration from MySQL2](#migration-from-mysql2)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)

## History and Why MySQL2

MySQL2 project is a continuation of [MySQL-Native][mysql-native]. Protocol parser code was rewritten from scratch and api changed to match popular [Node MySQL][node-mysql]. MySQL2 team is working together with [Node MySQL][node-mysql] team to factor out shared code and move it under [mysqljs][mysqljs] organization.

## Why SingleStore Node.js Driver

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

If you are using TypeScript, you will need to install `@types/node`.

## Quick Start

```javascript
const singlestore = require('singlestore_nodejs');

// Create connection
const connection = singlestore.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  port: 3306,
});

// Simple query
connection.query('SELECT * FROM users', (err, results, fields) => {
  if (err) throw err;
  console.log(results);
});

// Using promises
connection
  .promise()
  .query('SELECT * FROM products')
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

📚 **Full documentation:** [SingleStore Nodejs Driver][docs-base]

- [Getting Started][docs-documentation]
- [Examples][docs-examples]
- [FAQ][docs-faq]
- [API Reference][docs-api]

## Contributing

Contributions are welcome! Please see [Contributing.md](Contributing.md) for details.

## Acknowledgments

This project is a fork of [mysql2](https://github.com/sidorares/node-mysql2) by @sidorares. We are grateful for the excellent foundation provided by the MySQL2 project.
