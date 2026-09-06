# Original Truffle project — preserved archive

This directory preserves all 32 files tracked in the original project before the rebuild, byte-for-byte. Paths are unchanged below this directory except:

- Original `build/` → `legacy/truffle-artifacts/` (historical compiled Truffle artifacts).

The archive includes the Solidity 0.4 contracts, migrations, tests, jQuery/Web3 frontend, GitHub Pages files, both Truffle configurations, package manifest/lockfile, notes, and old deployment script. Original attribution is retained in `package.json` and the repository history.

**Reference only.** The maintained application's install, compile, test, serve, and formatting commands exclude this directory. Its dependencies, bundled JavaScript, old network configuration, and contracts have not been modernized or security-reviewed.

**Do not run `deployfrontend.sh`.** It includes historical Git commit and push commands. It is preserved, not endorsed or used by the rebuild.

See the [root README](../README.md) for the new local development workflow and the [security notes](../SECURITY.md) for its boundaries. The old generated artifacts are archival reference, not the source of truth for the new application.
