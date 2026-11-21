[node-mysql]: https://github.com/mysqljs/mysql
[node-mysql2]: https://github.com/sidorares/node-mysql2
[docs-contributing]: https://singlestore-labs.github.io/singlestore-nodejs/docs/contributing
[singlestore-docs]: https://docs.singlestore.com/

# Contributing Guidelines

## Introduction

Contributions are always welcome. You can help the **singlestore-nodejs** community in various ways. Here are our major priorities, listed in order of importance:

- SingleStore compatibility and [Node MySQL][node-mysql] / [node-mysql2][node-mysql2] API alignment where it matters
- [Documentation][docs-contributing]
- Adding tests or improving existing ones
- Improving benchmarks
- Bug fixes
- Performance improvements
- New features

---

## Security Issues

Please contact project maintainers privately before opening a security issue on GitHub. That allows us to fix the issue before it is widely known.

### Contact

- Open a private security advisory on [singlestore-labs/singlestore-nodejs](https://github.com/singlestore-labs/singlestore-nodejs) when possible.

---

## New Features

It is better to discuss an API before implementing it. Open an issue on GitHub so we can agree on design and implementation.

---

## Development

You need:

- A **SingleStore** server for integration tests (CI uses [SingleStore dev](https://github.com/singlestore-labs/singlestoredb-dev))
- **Node.js** 20+ (matches CI)

The driver is pure JavaScript, so you can develop on Linux, macOS, or Windows:

```bash
git clone https://github.com/singlestore-labs/singlestore-nodejs.git

cd singlestore-nodejs

npm install
```

---

### Commits and Pull Request Titles

Use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) format.

Prefixes that trigger a release version:

- `fix:` — patch release
- `feat:` — minor release

Examples: `fix: message`, `feat: message`, `docs: message`, `fix(module): message`

---

### Including Tests

#### Fixes

Where possible, add a test that fails without your fix.

#### Features

Add tests that cover the new behavior.

---

### Running Tests

Integration tests need a running database and a `test` database. **CI** uses the `ghcr.io/singlestore-labs/singlestoredb-dev` image on port **3306** with user **root** and a non-empty `ROOT_PASSWORD` (see [`.github/workflows/tests.yml`](.github/workflows/tests.yml)).

#### Local SingleStore dev (recommended)

```bash
docker run -d --name singlestore-dev -p 127.0.0.1:3306:3306 \
  -e ROOT_PASSWORD=pass \
  ghcr.io/singlestore-labs/singlestoredb-dev
```

To keep the dev container from taking over your machine, you can add `--cpus=4 --memory=16g` to `docker run`; that is more than enough for the test suite. If your machine has fewer than 4 CPU cores, lower `--cpus` to match (Docker rejects a value above the host's core count).

Wait until the server accepts connections, then create the test database (password must match `ROOT_PASSWORD`):

```bash
until mysql -h127.0.0.1 -P3306 -uroot -ppass -e "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done
mysql -h127.0.0.1 -P3306 -uroot -ppass -e "CREATE DATABASE IF NOT EXISTS test;"
```

#### Environment variables

Match CI so `test/common.test.cjs` picks up your password (`CI=1` enables `MYSQL_PASSWORD`):

```sh
export CI=1
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=pass
export MYSQL_DATABASE=test

bash run-all-tests.sh
```

**CI** runs the same `bash run-all-tests.sh` script (see [`.github/workflows/tests.yml`](.github/workflows/tests.yml)). It skips entries listed in [`test-to-skip.txt`](test-to-skip.txt)—integration tests that are not supported or do not apply on SingleStore—so local full-suite results match CI. `npm run test` runs Poku over `test/esm`, `test/unit`, and `test/integration` **without** that skip list; use it for quick iteration or filtered runs, not as a CI parity check.

For a plain local MySQL with **no** root password, omit `CI` and leave `MYSQL_PASSWORD` unset; the harness defaults to an empty password.

#### Subset of tests

```sh
FILTER='test-load-infile' npm run test
```

Or run one file:

```sh
node ./test/integration/connection/test-load-infile.test.cjs
```

Some tests call `SET GLOBAL local_infile = true`; that requires sufficient privileges on the server (SingleStore dev typically allows it).

#### Coverage

```bash
npm run coverage-test
```

For server setup details, see [SingleStore documentation][singlestore-docs].
