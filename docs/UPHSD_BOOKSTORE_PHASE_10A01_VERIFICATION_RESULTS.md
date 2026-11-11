# UPHSD Bookstore POS — A01 deployment/provider and account verification

Date: 2026-11-02, Asia/Manila. Local HEAD: `2e9942e` with the pre-existing Phase10A source changes and audit documentation.

**Status: local evidence review completed; live verification stopped at the access/target-confidence gate.** No live account inventory, provider environment inventory, deployed-source comparison or credential-rotation verification was completed. Unknown counts are not zero counts. No credentials are claimed rotated or revoked.

## 1. Executive summary and stop condition

The repository points to a Render-hosted API URL, contains a MongoDB Atlas hostname in its configured database URI, and permits a Netlify frontend origin. These are verified **local configuration references**, not verified deployments or provider ownership.

Provider integration discovery found Render and MongoDB Atlas available but not installed/connected in this session. No authenticated provider metadata tool for these services was available. The inspected process did not have the standard provider API-token variables listed below. This is not proof that no credentials or access exist elsewhere; browser sessions, CLI credential stores and other machines were not inspected.

The installed native MongoDB driver accepts the configured URI without connecting. It resolves the database name to the default/test database, without a name identifying LadyPos/ServeFlow/UPHSD Bookstore. That does **not** prove the target is wrong: this application may legitimately have used that database. Its ownership/project association and available read-only scope were not established confidently. No database connection or account query was attempted.

The user's instruction was: **“If read-only access cannot be established confidently, stop and request guidance.”** Accordingly, live database/provider verification stopped. This report and the implementation-plan appendix are the only writes made after that stop. Resume requires an approved provider connection and confirmation of the intended database/service targets. Do not provide secret values in chat or reports.

## 2. Environments and providers: verified versus unavailable evidence

| Environment/component | Verified local fact and evidence | Live status |
| --- | --- | --- |
| Current local checkout | Existing client/backend application and Phase10A working-tree changes are present; HEAD remains `2e9942e` | Verified local source only; not a deployment |
| API provider reference | `client/.env` VITE_API_URL has an HTTPS Render hostname and a URL path; no embedded URL credentials were detected | Render reference verified; service ownership, availability, environment count, region and deployed settings unknown |
| Database provider reference | Configured backend URI contains the MongoDB scheme and Atlas hostname marker; native MongoClient constructor accepts it | Atlas reference verified; project, cluster, database ownership, user grants and connectivity unknown |
| Database target | Native driver options resolve to the default/test database; no project-identifying name was established | Requires explicit target confirmation; no account/collection read performed |
| Frontend hosting reference | `backend/app.js` permits a Netlify origin; `client/public/_redirects` contains SPA fallback rules | Hosting hint only; does not prove an active Netlify site, ownership or production environment |
| Source repository provider | Configured `origin` remote hostname identifies GitHub | Remote configuration verified; no remote repository/deployment records fetched |
| Staging/preview/production environments | No environment/service inventory from an authenticated provider | Unknown; do not infer a single production environment or absence of staging |
| Local provider linkage | No `.netlify/state.json`, netlify.toml, render.yaml/yml, railway.json/toml, `.vercel/project.json`, `.openai/hosting.json`, `.github/workflows`, docker-compose.yml or Dockerfile found at inspected root paths | Missing local linkage is not proof that deployment resources do not exist |

No public production endpoint, root log viewer, deployed application, provider dashboard or configured database was accessed. A CORS origin or an API URL is not a verified deployment record. No environments were created or removed.

## 3. Access discovery and verification methods

### Provider access

Integration discovery returned Render and MongoDB Atlas as available and uninstalled/unconnected. Their connection setup was offered; suggesting access does not install/connect them or establish provider permissions. No permission setting was changed. No account metadata, environment values, logs or audit records were retrieved through those services.

The following process-variable presence checks returned absent: NETLIFY_AUTH_TOKEN, RENDER_API_KEY, RAILWAY_TOKEN, VERCEL_TOKEN, MONGODB_ATLAS_PUBLIC_API_KEY and MONGODB_ATLAS_PRIVATE_API_KEY. Only presence booleans were emitted. Other authentication methods may exist; no broad filesystem search for credentials, CLI login, browser-profile access or provider authentication attempt was made.

No Netlify-specific connected capability was established by discovery. The search is not an exhaustive catalog of all integrations or authentication options. Unrelated available hosting tools were not used to infer this project's deployment.

### Local configuration and database parsing

Configuration files were processed privately in memory to emit only variable names, provider classifications and nonsecret validation flags. No URI, credential, token, password, hash or secret fingerprint was printed or copied into this report.

An initial general URL parser did not accept the MongoDB URI. The **installed MongoDB native driver did accept it**. A general URL-parser result is not evidence of a broken MongoDB configuration. MongoClient was constructed and closed without calling connect or issuing any command. No Mongoose startup/model connection was used; no auto-index or schema activity occurred.

Native parsing established only that a driver-recognized URI and default/test target are configured. It did not validate the credentials, prove read-only grants or verify the target's project association. No DNS/authentication attempt, ping, collection listing, find or aggregation was issued against the configured database.

### Preservation controls

At entry,148 files were hashed, including source, reports, environment files and all three pre-existing lockfiles. The pre-existing Git status was recorded. Git/dependency implementation directories were excluded except `backend/node_modules/.package-lock.json`, which was explicitly included. No environment or dependency files were changed, and no test/database/seed/startup script was run as part of this A01 review.

## 4. Expected configuration: source requirements versus deployed settings

| Name | Source requirement/local evidence | Deployed verification |
| --- | --- | --- |
| MONGO_URI | Present in local backend configuration; consumed by `backend/config/config.js` and explicit seed execution | Provider key presence/binding/value revision unknown; no deployed value retrieved |
| JWT_SECRET | Present locally; used by `backend/utils/generateToken.js` and `backend/middleware/authMiddleware.js` | Provider key presence, secret identity/revision and service rollout unknown |
| MONGO_PASS | Present locally; no direct current application consumption found | Its provider use/other consumers and rotation status unknown; do not delete or assume it is unused everywhere |
| VITE_API_URL | Present in client configuration; used by auth/API/readiness code; points to Render | Build-time configuration/revision of the deployed client unknown; local presence does not prove deployed bundle settings |
| SEED_ADMIN_PASSWORD | Required only when explicitly running the protected admin provisioning utility | Not required for ordinary API startup; no seed performed or provider setting requested |

Read source references: `backend/app.js`, `backend/config/config.js`, `backend/index.js`, `backend/utils/generateToken.js`, `backend/middleware/authMiddleware.js`, `backend/utils/seedAdmin.js`, `client/src/shared/utils/apiClient.js`, `useServerReady.js`, and `client/src/features/auth/api/authApi.js`.

Deployed key-name presence should be checked through **names-only metadata** once access exists. If a provider tool returns secret values together with names, do not use it for this request; obtain an approved redacted/key-name metadata method instead. Do not download deployment environment files or retrieve values as a shortcut.

## 5. Account inventory findings

**No live account records were queried or retrieved.** The database target/read-only confidence requirement was not met. The table records unavailable evidence explicitly rather than inventing an inventory.

| Required inventory result | A01 result | Evidence needed after access/target confirmation |
| --- | --- | --- |
| Total existing accounts | Unknown, not zero | Server-side count from the confirmed application database |
| Counts by assigned role | Unknown | Aggregate counts for admin/user/unrecognized or missing roles |
| Multiple/duplicate administrators | Not determined | Administrator count and duplicate normalized-identifier counts; multiple administrators are not inherently duplicates or unauthorized |
| Unexpected administrator accounts | Not determined | Management-approved roster plus limited metadata/provisioning/audit evidence; a role alone is not proof of legitimacy |
| Confirmation consistency | Unknown in live records | Aggregate true/false/missing/null/invalid-type buckets |
| Activation consistency | No separate activation field exists in the inspected User model; live record states unknown | Confirm intended activation semantics and inspect only approved state-field type/count metadata; do not equate an undocumented field with enforced authorization |
| Stored password formats | Unknown in live records | Server-side format/cost-range counts only; no password/hash field returned to the client or report |
| Password login compatibility | Current model accepts bcrypt2a/2b/2y-shaped inputs and rejects plaintext/malformed formats; synthetic compatibility was tested in Phase10B | Syntax counts do not prove a person's password works, distinguish double hashing, or prove password strength; live legitimate-user testing needs separate controlled scope |
| Administrator legitimacy audit | Current User model stores role, confirmed, profile fields and timestamps; it lacks creator/approval/role-change/security-event provenance | Provider/access evidence and management roster are required; timestamps/administrator role are insufficient |

The current `backend/models/User.js` defines only admin/user roles and confirmed, with timestamps. It does not contain a distinct isActive/disabled state, last-login history, account-approval actor or token-revocation epoch. Actual historical documents may differ; no assumption about their contents was made.

### Minimum safe inventory method proposed for resumption

After target ownership and read-only access are confirmed, use the installed native driver or an approved connected provider with **only read commands**, no application startup/seed and no automatic index management. Prefer an identity restricted to read access on the exact database. Establish scope through provider metadata/grants before querying; do not assume the existing application credential is read-only.

Run bounded server-side count/group/type/format aggregates. Return only counts and approved nonsecret metadata. Classify password fields on the server into compatible bcrypt prefixes/cost buckets, malformed bcrypt-like values, other strings, missing and other types. Never return a password/hash sample, prefix fragment, digest, fingerprint or raw document. Label non-bcrypt strings as unclassified/incompatible; do not assert that every such string is plaintext. Never use aggregation output stages such as `$out`/`$merge`, administrative write commands, inserts, updates, deletes or migrations.

Duplicate normalized identifiers can be counted without exporting identifiers. A multiple-administrator count must be reconciled with the management roster before marking any account unexpected. Start with aggregate results; request narrower metadata only if needed and approved. Do not change any record as part of the inventory.

## 6. Credential rotation status

| Credential/control | Provider status | What is known |
| --- | --- | --- |
| Database credential replacement/revocation | **Unknown** | No provider credential metadata or audit record obtained; URI parsing is not a validity or rotation test |
| JWT key rotation/deployment | **Unknown** | No deployed secret revision or coordinated rollout evidence obtained; no real token generated, tested or invalidated |
| Historical fixed seed password remediation | **Unknown** | Current seed no longer contains a fixed password; whether a real seeded account exists/was reset remains unknown |
| Local secret-file history | Prior Phase10B finding, not provider rotation evidence | Phase10B documented local values matching tracked history. This A01 preserves those files and does not claim a new rotation or live validity result |

To verify rotation later, obtain redacted provider events/credential IDs, creation/revocation status and timestamps, deployment revision/time and confirmation that authorized consumers use the intended replacement revision. Do not retrieve old/new secret values. Do not infer rotation from a changed filename, local source fix, passing test, connection success or administrative assertion without appropriate supporting evidence.

## 7. Deployed application versus local code

The local checkout contains uncommitted Phase10A fixes on top of HEAD `2e9942e`. There is no verified provider service/deploy ID, source revision, build artifact checksum or deployment timestamp to compare with it. No deployed version is claimed current or outdated on present evidence.

A deployed commit SHA equal to local HEAD would not, by itself, prove it contains the uncommitted fixes. Once provider access exists, compare the precise deployed revision/artifact provenance to a reviewed source snapshot including the actual Phase10A changes. Do not commit, push, build, fetch deployment artifacts containing secrets, change service settings or deploy merely to obtain a match during A01.

## 8. Existing access-control and session risks

These are current-source and previously documented synthetic findings, not newly observed live incidents:

- Administrator provisioning is backend-protected; current role/confirmation are loaded for protected requests. This does not validate the legitimacy of existing administrators.
- Password changes/resets do not revoke an already-issued valid token. Role promotion/reconfirmation can give a previous token elevated/restored access. Seven-day expiry remains; logout clears browser storage only. No actual token was revoked or tested here.
- Finer manager/cashier/inventory capabilities and shared-store membership remain unimplemented; owner-scoped existing business powers are preserved.
- Administrator-assisted reset exists, but self-service password recovery and durable security/privilege-change audit evidence are incomplete. Historical insecure password/account states require actual approved inventory before targeted decisions.
- Current frontend raw error/storage logging and browser token-storage inconsistencies remain Phase10B findings. No browser session or captured log was inspected or cleared.
- Previously exposed material in Git cannot be made safe merely by removing output from local source. Actual provider credential validity/rotation and deployed containment remain unknown.

See [Phase10B security results](UPHSD_BOOKSTORE_PHASE_10B_SECURITY_RESULTS.md) and [Phase10A results](UPHSD_BOOKSTORE_PHASE_10A_RESULTS.md) for source evidence and prior synthetic test boundaries. No tests were rerun or represented as live-environment acceptance in this review.

## 9. Live administrative confirmation required

1. Identify the intended Render service/workspace and any production, staging or preview environments. Establish an approved connection capable of reading metadata without environment-secret values. Identify the frontend provider/site rather than treating a CORS origin as ownership proof.
2. Identify the intended Atlas project/cluster and confirm whether the default/test database is the bookstore's actual account database. If not, provide the correct **nonsecret database identifier** through an approved metadata channel; do not paste a replacement connection string or password.
3. Establish read-only grants for the exact account inventory target. Confirm whether an existing approved provider connection or restricted database identity should be used. Do not create a new database user, change access lists or permissions during A01 without separate authorization.
4. Supply or make available approved administrator-roster/provisioning evidence. Counts/roles alone cannot establish administrator legitimacy.
5. Make redacted credential lifecycle/audit events and deployed source revision available through authorized metadata access. Do not expose secret values or raw historical log streams.

No credential, account, session or deployment remediation is implied by these access confirmations.

## 10. Recommended actions and approval boundaries

| Next action | Approval requirement |
| --- | --- |
| Resume A01 metadata and aggregate inventory | Existing A01 authorization applies once the target and approved read-only connection are established; user guidance is required to resolve the current access/target ambiguity |
| Set up a missing provider integration or change access/grants | Requires the user's individual connection/access approval; no installation, grant, API-key creation, database-user creation or allowlist change was performed |
| Coordinate database/JWT rotation | Separate A02 approval after provider/consumer evidence; no values retrieved or rotation performed |
| Reset/deactivate/remap or otherwise remediate accounts | Separate A03 approval for exact accounts/actions after inventory/identity review |
| Revoke sessions/change password recovery or authorization | Separate A04 reviewed implementation and any schema/compatibility/session-impact approval |
| Fix frontend logging/storage | Separate A05 implementation approval |
| Untrack secrets/rewrite history | Separate A06 repository coordination/approval; not a substitute for rotation |
| Deploy or change production configuration | Separate explicit release/configuration authorization |

## 11. Delivery and verification record

Created this report at the exact requested path and appended a concise A01 summary to [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). No previous report or plan entry was rewritten. Application/test code, environment files, all three pre-existing lockfiles and Phase10A changes remain preserved.

Executed checks: local source/config-name/provider-reference inspection; available-integration discovery; provider credential-variable **presence-only** checks; native URI parsing with **zero database connections/commands**; Git working-tree/reference inspection. No live account test, provider metadata request, build, dependency install, migration, database startup, credential validity attempt, settings update or deployment was performed.

Final delivery validation passed:147 of148 baseline files unchanged; only the plan appendix changed and this report was added; no files removed. The original plan bytes remain an exact prefix. Environment files and all three pre-existing lockfiles match the baseline. Fourteen relative links resolve, fences are paired and configured-secret comparisons found0 matches in the two delivered documents. `git diff --check` reports no whitespace errors; existing CRLF notices concern unchanged Phase10A files. Live verification remains incomplete pending the guidance above. Stop here; no remediation phase follows automatically.

## 12. Resume request: prerequisite check — 2026-11-02

The resume request requires using only explicitly confirmed targets and proving database identity/read-only scope before connecting. Its Render service, Atlas project and database fields contain `[PROVIDE CONFIRMED IDENTIFIER]` / `[PROVIDE CONFIRMED DATABASE NAME]`; the access-method field contains `[DESCRIBE APPROVED METHOD]`. These are unfilled placeholders, not confirmed targets, credentials or evidence of restricted access.

**Result: stopped before connection.** No provider discovery/access, database connection, metadata/account query, credential retrieval, authentication attempt, test or remediation was performed during this resume attempt. Prior configuration hints were not substituted for the missing confirmations. Newly available Render capabilities alone do not establish the intended service, Atlas database association or read-only permissions.

| Required prerequisite | Evidence supplied | Status |
| --- | --- | --- |
| Render service name/ID | Placeholder only | Not confirmed |
| MongoDB Atlas project name/ID | Placeholder only | Not confirmed |
| Intended database name and bookstore association | Placeholder only | Not confirmed; default/test database must not be assumed |
| Approved access method that cannot modify data | Placeholder only | Not described or verified |

Deployment revisions/environments, database/collection metadata, account counts/roles/confirmation, live password-format counts, credential rotation and administrator legitimacy remain **unknown**. No zero counts, legitimate administrators or successful rotations are inferred.

To resume under the existing A01 authorization, supply the actual nonsecret service/project/database identifiers and the approved access method, including evidence that its permissions cannot modify data. Do not send passwords, tokens, connection strings or password hashes. Targets and restricted scope must be verified before any connection. Separate remediation approval remains required.

Only this dated addendum was appended. The implementation plan, previous report text, application/test code, environment files, all three lockfiles and other pre-existing working-tree changes were preserved. No new phase began.

## 13. Local-only configuration and access preparation — 2026-11-02

**Scope:** the user explicitly prohibited all external-service and database connections for this continuation. This section records local file/documentation/installed-library inspection only. No provider discovery call, network request, DNS lookup, database client connection, application startup, seed, test suite, installation, build or deployment was performed. Earlier observations above retain their original dates and boundaries.

### 13.1 Confirmed local references and missing deployment records

| Item | Local finding | Limit |
| --- | --- | --- |
| Render/API reference | `client/.env` VITE_API_URL identifies public host `ladypos.onrender.com` and path `/api`; no embedded URL user information was detected | A public hostname is a reference, not a confirmed Render service name/ID, workspace, owner or active deployment. No request to that host was made |
| Frontend origin | `backend/app.js:25` permits localhost development and `serveflow.netlify.app`; `client/public/_redirects` supplies SPA fallback | A CORS allowlist is not deployment/ownership evidence. Apache rules also exist in `client/public/.htaccess`; neither file establishes the actual selected host |
| Atlas reference | Private, in-memory URI parsing identifies Atlas hostnames | A hostname/cluster reference does not establish an Atlas project name/ID or bookstore ownership; no host, credential or connection string is reproduced |
| Atlas project identity | No confirmed project name/ID or administrator-approved project-to-database mapping found in reviewed project configuration/documentation | Prior reports contain requests/placeholders, not confirmations. A URI client application-name label must not be treated as an Atlas project identifier |
| Connection setting | `backend/config/config.js:5` consumes MONGO_URI. The explicit seed utility consumes the same variable at `backend/utils/seedAdmin.js:20` | The seed was not run. MONGO_PASS is present in local configuration but has no direct current source consumer; its presence does not select a database |
| Environment examples/manifests | Recursive nondependency file inventory found backend/.env and client/.env, but no `.env.example`, `.env.sample`, `.env.template`, Render YAML, netlify.toml, provider-link state, Dockerfile/compose, Procfile, Railway/Vercel manifest or root CI workflow | Existing documentation proposes future templates/settings; proposals are not current deployment configuration |
| Deployment commands | Separate package scripts define Node API start and Vite client build; root backend listener uses fixed5000 | No local manifest binds these to a verified Render environment or deployed revision. No command was executed |

The documentation search included the bookstore documents and existing audit/architecture/deployment documents. **No authoritative intended application database name is documented.** References to driver-default `test`, test fixtures, collection names, proposed environment variables and the unfilled database placeholder are not management approval of a production database.

The older `docs/implementation/deployment-plan.md` contains pre10A audit descriptions and proposed environment settings. It is historical planning evidence, not a current provider export or a declaration of database ownership. No existing document was rewritten to conceal those distinctions.

### 13.2 Exact database-selection behavior

Confirmed source and installed dependency path:

1. `backend/index.js:5` calls dotenv.config; the normal package start script runs that entry point from backend. In the installed dotenv code, an already-present process variable is preserved unless override is explicitly enabled (`backend/node_modules/dotenv/lib/main.js:378`). Therefore a provider-supplied MONGO_URI can differ from the local file; this review cannot infer the deployed value from the workstation.
2. `backend/config/config.js:5` passes **only** process.env.MONGO_URI to mongoose.connect. It supplies no options.dbName. The seed uses the same single-argument form. No application useDb/createConnection/database-name override or production DB_NAME/MONGODB_DATABASE-style setting was found. No such setting was added.
3. Mongoose's installed native connection implementation takes an explicit options.dbName when supplied and otherwise calls client.db() (`backend/node_modules/mongoose/lib/drivers/node-mongodb-native/connection.js:302` and`:433`).
4. Module resolution confirms this Mongoose installation uses `backend/node_modules/mongodb`, version7.1.1. That driver's parser reads an application database from the URI path (`lib/connection_string.js:203`) and assigns `test` when no dbName was supplied (`:330`). MongoClient.db with no argument uses that resolved name (`lib/mongo_client.js:390`). These are reads of installed source files, not a connection attempt.
5. Private parsing of the actual local configuration confirms **no database in the URI path and no dbName query option**. The URI does contain authSource and appName options; their values were not emitted. authSource controls authentication scope, and appName labels the client; neither is proof of the application's intended data database.

**Conclusion:** with the inspected local URI and unmodified startup path, application data selection falls back to the driver's `test` default. The application does not explicitly select a bookstore database. This establishes current local selection behavior only. It does not establish that `test` is correct, populated, owned by this project, safe to inspect or equivalent to the deployed target. Do not change the URI or add a database override during this review.

The URI parser package was used only as a local string parser. No MongoClient or Mongoose connection was opened, no SRV/DNS discovery was requested and no metadata/account query was issued. Raw URI values, authentication options and password/hash contents were not emitted.

### 13.3 Nonsecret evidence an authorized administrator must obtain

| Source | Required nonsecret confirmation/evidence |
| --- | --- |
| Render ownership/target | Workspace/team identifier; exact service name and service ID; production/staging/preview environment designation; public API hostname matching the intended bookstore service. A hostname-derived guess is insufficient |
| Render deployment identity | Current deploy ID, source repository/branch, deployed commit SHA or other source provenance, deploy timestamp, root/start/build settings and applicable frontend build provenance. State whether deployment includes the uncommitted Phase10A changes; local HEAD alone cannot prove that |
| Render configuration metadata | Names-only presence and service/environment-group binding for MONGO_URI and JWT_SECRET, plus public VITE_API_URL at the client build boundary. Clarify any MONGO_PASS consumer. SEED_ADMIN_PASSWORD concerns explicit provisioning, not ordinary runtime. Supply metadata/revision IDs, never values or downloaded environment files |
| Atlas ownership/target | Project name/ID, cluster name/ID, exact application database name and management confirmation that it contains this independent POS's records. Confirm whether `test` is intentional rather than accepting the fallback automatically |
| Atlas account collection | Exact User collection name and its project/database association. User.js registers the User model, whose expected default collection is users; actual live metadata is unverified |
| Read-only identity and grants | Approved access method/identity alias, database/cluster restrictions, all effective direct/inherited/custom roles and their permitted actions, evidence timestamp and approving administrator. No username/password URI, token or password is needed in this report |
| Credential lifecycle | Redacted credential IDs, creation/replacement/revocation metadata, audit-event IDs/times and rollout/revision evidence. A configuration key name or successful connection would not establish rotation |
| Administrator legitimacy | Management-approved roster/provisioning or approval evidence and available security-event metadata; an administrator role or creation timestamp alone is insufficient. Start with aggregate results and avoid unnecessary personal details |

No provider data above was obtained in this local-only continuation. Environment existence/counts, live database/collection metadata, account totals/roles/states/password formats, administrator legitimacy and rotation remain **unknown**.

### 13.4 Recommended read-only method and offline verification

**Preferred direct inventory method, for a separately permitted future connection:** reuse an existing dedicated identity whose effective database privileges are restricted to the built-in read role on the exact confirmed bookstore database, with appropriate cluster restrictions and no additional inherited/custom write, user/role-management or broader administrative rights. Provider metadata access must likewise be restricted to reading the named project's/service's metadata. Atlas project/control-plane access and MongoDB database-user grants are different permission layers; one does not prove the other.

This is a proposed grant specification, not a claim that any current identity has it or that a role name alone proves enforcement. No identity, API key, permission, allowlist, role or connection was created or changed. If a restricted identity does not already exist, provisioning it requires separate authorization.

For eventual password-format classification, run only approved, bounded server-side aggregates returning format/cost/count buckets. Do not retrieve User documents containing password fields, samples, hashes or secret fingerprints. The built-in read role prevents database writes but does not itself prevent reading sensitive fields; the approved inventory method must additionally constrain returned fields/results. Never include output stages such as $out/$merge or any write command. Do not use the application's normal connection credential unless its exact target and effective read-only scope are proven.

**Verification without an agent connection:** an authorized administrator can supply a recent, redacted provider permission/role-assignment export or screenshot showing the service/project/cluster/database identifiers, the identity alias, effective role/action definitions including inherited/custom grants, cluster scope and issuance/review time. Review that evidence locally against the approved target and the read-only specification. Require an explicit management attestation linking those resources to UPHSD Bookstore POS. This needs no secret values and no agent database session.

Offline evidence can establish that the supplied authorization record is consistent with the intended scope; it cannot independently prove live permissions are unchanged or that the presented identity will be the one used by an unseen connection. If the evidence is missing, stale or ambiguous, do not connect. An alternative is administrator-produced aggregate inventory and metadata exports for local review, with no agent database connection at all. Mark such results administrator-supplied rather than independently queried.

Do not treat readPreference/readConcern, a URI's authSource, a client appName, CORS, selecting a read-looking tool, or an intention to issue only find/aggregate as proof that the identity cannot modify data. Do not test permissions by attempting a write, creating a temporary record or rolling back an insert. No such test is authorized.

### 13.5 Resume checklist and preservation

Before any future externally authorized A01 connection, obtain:

- Exact Render workspace/service ID and environment; source/deploy revision and names-only configuration evidence.
- Exact Atlas project/cluster and intended database, explicitly approving or rejecting the local `test` fallback; confirm the User collection.
- Approved existing read-only access method plus current effective-grant evidence and bookstore ownership mapping; no secrets.
- Redacted credential lifecycle/audit metadata and administrator-roster/provisioning evidence needed for rotation/legitimacy conclusions.

This local-only task appended this section to the A01 report only. It did not change the implementation plan, source, environment files, lockfiles, prior report text or database records. No existing business rule or access permission was changed. Verification remains stopped pending target/permission evidence and an instruction permitting external read-only access; this message's no-connection restriction remains in force. No remediation follows automatically.

## 14. Administrator confirmation checklist — 2026-11-02

**Live verification remains stopped.** All fields below are **unknown** until supported by an authorized administrator's confirmation and appropriately redacted evidence. Supply nonsecret identifiers and metadata only; exclude passwords, connection strings, tokens and password hashes.

| Confirm | Required nonsecret details/evidence | Current status |
| --- | --- | --- |
| [ ] Render service | Workspace/team, service name/ID and environment designation | Unknown |
| [ ] Render deployment | Deploy ID, deployed commit/revision, repository/branch and deployment time; establish whether Phase10A fixes are included | Unknown |
| [ ] Atlas target | Project name/ID, cluster name/ID and exact intended application database | Unknown |
| [ ] Bookstore ownership | Named authorized approver, confirmation date and evidence linking the exact database/resources to this independent UPHSD Bookstore POS project | Unknown |
| [ ] User-account collection | Actual collection name in the confirmed database; the model's expected `users` name is not live evidence | Unknown |
| [ ] Read-only identity/method | Approved existing identity alias and access method, restricted to the confirmed service/project/cluster/database | Unknown |
| [ ] Effective permission evidence | Current redacted role/action and scope export, including direct, inherited and custom grants; demonstrate no write, user/role-management or deployment-setting permissions; identify evidence date and approving administrator | Unknown |
| [ ] Credential lifecycle | Available redacted credential IDs, creation/replacement/revocation audit metadata and rollout evidence; identify unavailable records explicitly | Unknown; no rotation verified |
| [ ] Administrator provisioning | Approved administrator roster and available creator/approval/role-change audit evidence; an administrator role alone does not establish legitimacy | Unknown |

**Database identity rule:** `test` is only the observed local driver fallback. It must not be inferred to be the intended bookstore database. Any confirmation that `test` is intentional requires the same ownership and permission evidence as another database name.

**Resume gate:** resume live A01 verification only after an authorized administrator confirms the required identifiers, bookstore ownership and effective read-only permissions. Missing, ambiguous or unsupported confirmation keeps verification stopped. Do not test restrictions by attempting writes. This checklist authorizes no credential rotation, account/session change, deployment or other remediation.

Execution record: only this checklist was appended; prior report text and execution history are preserved. No external/provider/database connection, application/configuration edit, account/credential/session action, deployment-setting change or implementation work occurred.
