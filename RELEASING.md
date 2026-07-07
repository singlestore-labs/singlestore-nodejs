## Releasing

Bump the version in `package.json` and `package-lock.json` on `master`, then push a semver tag (`v*.*.*`). That triggers the [Release](.github/workflows/release.yml) GitHub Action. It runs the full test suite against SingleStore, creates a GitHub release with auto-generated notes, and publishes to npm.

Create and push a release tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag must match `package.json` (for example version `1.0.0` → tag `v1.0.0`).

Each release publishes `singlestore-nodejs` to npm with:

- `lib/`
- `typings/mysql/`
- `index.js`, `index.d.ts`
- `promise.js`, `promise.d.ts`

To run the same tests locally:

```bash
export CI=1
export MYSQL_HOST=127.0.0.1
export MYSQL_USER=root
export MYSQL_PASSWORD=
export MYSQL_DATABASE=test

bash run-all-tests.sh
```

See [Contributing.md](Contributing.md#running-tests) for SingleStore setup details.

Pull requests run the [Run Tests](.github/workflows/tests.yml) workflow. The [Release](.github/workflows/release.yml) workflow runs the same tests before publishing.
