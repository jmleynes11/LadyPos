# Dependency advisory audit (F23)

Date2026-11-02. Commands: `npm audit --json --ignore-scripts` from each package. Initial sandbox scans failed DNS and some retries returned ECONNRESET. A backend retry returned a complete report; a later client retry also returned a complete report. Both exited1 because vulnerabilities were reported. A subsequent backend retry failed and does not negate the earlier observed report. No dependencies or lockfiles were changed.

Counts are affected dependency entries reported by npm, including inherited and development findings. They are not counts of unique independently exploitable vulnerabilities. Backend: **8 entries:1 critical,3 high,4 moderate**. Client: **22 entries:12 high,9 moderate,1 low**.

## Backend observed result

Versions are from the inspected lockfile; severities and representative advisory URLs are from the successful observed npm output. Some packages have multiple advisories; this is a summary rather than the full registry payload.

| Package | Locked version(s) | npm severity | Direct | Lockfile scope | Representative source |
| --- | --- | --- | --- | --- | --- |
| body-parser | 2.2.2 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| brace-expansion | 5.0.5 | high | no | development only | [advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895) |
| minimatch | 10.2.4 | moderate | no | development only | inherited; inspect chain |
| mongoose | 9.3.3 | moderate | yes | production graph or mixed | [advisory](https://github.com/advisories/GHSA-664h-wqgq-64gw) |
| nodemon | 3.1.14 | moderate | yes | development only | inherited; inspect chain |
| path-to-regexp | 8.3.0 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-j3q9-mxjg-w52f) |
| proxy-addr | 2.0.7 | critical | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| qs | 6.15.0 | moderate | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |

## Client observed result

| Package | Locked version(s) | npm severity | Direct | Lockfile scope | Representative source |
| --- | --- | --- | --- | --- | --- |
| @babel/core | 7.29.0 | low | no | development only | [advisory](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) |
| @eslint-community/eslint-utils | 4.9.1 | moderate | no | development only | inherited; inspect chain |
| @eslint/config-array | 0.21.2 | moderate | no | development only | inherited; inspect chain |
| @eslint/eslintrc | 3.3.5 | moderate | no | development only | inherited; inspect chain |
| @humanfs/node | 0.16.7 | moderate | no | development only | [advisory](https://github.com/advisories/GHSA-p498-v437-472g) |
| axios | 1.13.6 | high | yes | production graph or mixed | [advisory](https://github.com/advisories/GHSA-3p68-rc4w-qgx5) |
| baseline-browser-mapping | 2.10.10 | moderate | no | development only | [advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) |
| brace-expansion | 1.1.12 | high | no | development only | [advisory](https://github.com/advisories/GHSA-f886-m6hf-6m8v) |
| browserslist | 4.28.1 | high | no | development only | [advisory](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) |
| eslint | 9.39.4 | moderate | yes | development only | inherited; inspect chain |
| eslint-plugin-react-refresh | 0.5.2 | moderate | yes | development only | inherited; inspect chain |
| follow-redirects | 1.15.11 | moderate | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-r4q5-vmmm-2653) |
| form-data | 4.0.5 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) |
| js-yaml | 4.1.1 | high | no | development only | [advisory](https://github.com/advisories/GHSA-h67p-54hq-rp68) |
| minimatch | 3.1.5 | moderate | no | development only | [advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| nanoid | 3.3.11 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) |
| postcss | 8.5.8 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) |
| react-router | 7.13.2 | high | yes | production graph or mixed | [advisory](https://github.com/advisories/GHSA-49rj-9fvp-4h2h) |
| react-router-dom | 7.13.2 | high | yes | production graph or mixed | inherited; inspect chain |
| source-map-js | 1.2.1 | high | no | production graph or mixed | [advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| vite | 8.0.3 | high | yes | production graph or mixed | [advisory](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) |
| zod | 4.3.6 | high | no | development only | [advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |

## Reachability and remediation

The critical proxy-addr advisory concerns trusted-IP/subnet handling. This API does not configure trust proxy or use client IP as an authorization boundary in inspected source; actual deployment proxy settings are unknown. No exploit was executed. Runtime body-parser/path-to-regexp and Mongoose findings require trigger/version review; backend nodemon/minimatch/brace-expansion primarily affect development tooling.

Axios is used by a browser SPA. Node-adapter SSRF advisories may not be reachable through that usage. React Router is a client router here, with no demonstrated server-rendering framework use. Vite/ESLint/build-tool risks require separate assessment of developer servers and emitted artifacts. Do not describe all22 client entries as deployed browser exploits.

For each advisory record exact node/version, trigger, reachability, patched compatible version, mitigation, test evidence and residual risk. Update through reviewed manifests/locks preserving pre-existing changes, then run clean install, build/lint and meaningful API/DB/browser regressions. Never apply npm audit fix --force blindly: observed backend report includes a suggested major nodemon downgrade. Re-scan and retain sanitized machine-readable output in future CI.

F23 is HIGH/P1 as an application review/remediation item. npm severities in the tables are preserved independently. P0 application credential/authorization/payment defects remain immediate blockers.
