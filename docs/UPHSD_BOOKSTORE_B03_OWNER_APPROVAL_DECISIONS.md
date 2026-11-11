# B03 — Owner approval decisions

Date: 2026-11-04, Asia/Manila. Status: **PENDING OWNER RESPONSE. B03 remains one blocked, incomplete major phase.**

This sheet was absent at continuity inspection. It extracts existing options from [B03 results section 4](UPHSD_BOOKSTORE_B03_IMPLEMENTATION_RESULTS.md#4-owner-decisions-required-before-affected-implementation) and [B03 independent review](UPHSD_BOOKSTORE_B03_INDEPENDENT_REVIEW.md). Recommendations also cite Phase 15E section 4 where present. No option, recommendation, execution authorization or silence constitutes business approval.

## Continuity assessment

- Complete within prior local scope: B01 policy/manifest foundation after R2 review; B02 authoritative roles, account administration, lifecycle, expiring grants, atomic account audits and commit protections. Original B01 FAIL is historical; subsequent R2 PASS WITH LIMITATIONS is retained.
- Incomplete: shared resource/processor/subject scope, operational field enforcement and audits, inventory movement/idempotency, positive role-specific histories, kiosk ownership, financial reversal workflow and actual capability-driven frontend.
- Blocked: dependent implementation pending D1–D4. Complete B03 independent verdict remains FAIL. All RB01–RB17 remain mandatory.
- Prior verification only: backend 228/228; client 16/16; independent focused 126/126; build and 80 syntax checks passed; targeted lint clean; full client lint 16 errors/13 warnings. No suites were rerun for this documentation-only continuity update. Native database behavior remains unverified.

## D1 — Shared bookstore scope and historical attribution

**Question:** Which accounts/resources belong to the shared bookstore, and how are historical cashier ownership and unresolved records handled?

| Existing option | Advantages | Risks / required safeguards |
| --- | --- | --- |
| D1.1 Additive explicit bookstore identity/membership; retain owner provenance; server-scope new records; share old records only through reviewed exact-resource mappings | Separates bookstore scope, creator, cashier and customer identity; preserves historical references | Requires reviewed memberships/mappings and compatible readers/indexes; missing scope must never mean public/shared |
| D1.2 Exact owner/resource allowlist for one bookstore | Explicit bounded access without globally removing owner filters | Allowlist maintenance and linked-record validation; owner identity still cannot substitute for missing historical processor or student proof |

**Documented recommendation:** Phase 15E section 4C recommends an additive bookstore identity (`storeId`) and explicit membership, retaining owner separately. This is not approval of live membership or a backfill.

**Required owner response:** select D1.1 or D1.2; specify unmapped-resource treatment, duplicate SKU/receipt handling, missing-processor treatment and Administrator report scope. Actual IDs/mappings require separately authorized verified inventory; do not infer them from this policy selection.

**Approved policy:** NONE. **Affected work:** shared catalog/inventory/orders/history/receipts/customer scope and operational audit scope.

## D2 — Legacy operational access cutover

**Question:** B02 preserves unreviewed legacy `user` access, including price/stock/void commands. How is this reconciled with B03 ceilings on every API?

| Existing option | Advantages | Risks / required safeguards |
| --- | --- | --- |
| D2.1 Narrow B03 operational cutover replaces the old endpoint envelope while preserving accounts/history/authentication and requiring reviewed role assignments | Allows consistent backend pricing, inventory and reversal enforcement | Changes the approved compatibility envelope and can interrupt unreviewed users' operations; requires explicit owner approval, transition timing and reviewed assignments; no automatic conversions |
| D2.2 Retain B02 envelope and leave B03 incomplete until separately approved cutover | Preserves existing compatibility decision | Broad legacy powers remain; cannot truthfully accept complete B03 or expose an alternate legacy bypass as compliant |

**Documented recommendation:** existing B03 review says retain current guards while blocked and obtain cutover approval. It does not select D2.1 on the owner's behalf.

**Required owner response:** select D2.1 or D2.2. For D2.1 specify the local operational envelope and cutover conditions, handling of still-unreviewed accounts, and production transition gate. Preserve manual review, account IDs/history, confirmation/password protections and monotonic epochs.

**Approved policy:** NONE. **Affected work:** operational admission and every alternate legacy route that could bypass new restrictions.

## D3 — Guest/student ownership, privacy, field and fulfillment scope

**Question:** What proves guest ownership, which private fields are exposed, and which staff may fulfill an order?

Authenticated mode remains required alongside guest mode. Existing results identify using confirmed active B02 customer accounts, binding the subject from authenticated User rather than matching contact details, without adding registration requirements.

| Existing guest option | Advantages | Risks / required safeguards |
| --- | --- | --- |
| D3.1 Private per-order possession credential, separate from public order reference | Direct proof for one order; public reference alone cannot enumerate private orders | Credential theft/sharing; owner must define transport, lifetime, reset/recovery and rate policy |
| D3.2 Kiosk guest session | Can bind the guest interaction to its session | Shared-device handoff/session leakage; owner must define session lifetime, reset/recovery, cleanup and rate policy |

**Documented recommendation:** Phase 15E section 4D recommends a private unguessable access capability distinct from public order number, verifier storage where feasible, restricted status DTOs, and server-derived authenticated subject. It does not select lifetime/rate parameters or approve one guest transport.

**Required owner response:** select D3.1 or D3.2 and supply transport, lifetime, reset/recovery, rate and kiosk cleanup parameters; specify permitted status/contact fields, staff assignment/oversight, and cancellation/reservation/pickup behavior. Confirm authenticated binding through existing B02 customer accounts. Unassigned cost/contact CRUD/expense/export capabilities remain denied in new operational policy unless separately approved; legacy treatment follows D2.

**Approved policy:** NONE. **Affected work:** guest/student submission/tracking, protected DTOs, fulfillment and related UI. Both ordering modes remain mandatory.

## D4 — Sale/payment/refund/void/inventory effects

**Question:** What authorized state/effect rules govern sale settlement, refunds, voids, cancellations and stock returns?

| Existing option | Advantages | Risks / required safeguards |
| --- | --- | --- |
| D4.1 Owner supplies an explicit state/effect table for retained payment methods/credit, completion timing, reversal eligibility, full/partial handling, repayment, ledger and stock effects, cancellation and reconciliation | Enables implementation and meaningful positive financial/integrity tests without inferred rules | Incomplete table can produce inconsistent repayment/restocking or duplicate effects; every applicable transition needs a defined outcome |
| D4.2 Keep affected financial application routes unenabled until that table is supplied | Avoids implementing undefined repayment/accounting/restocking effects | Complete B03 remains blocked; preserving legacy endpoints is governed by D2, not silent removal |

**Documented recommendation:** Phase 15C requires financial/inventory effects before reversal implementation; existing reports recommend obtaining the effect contract. No payment-method, refund limit, full/partial, repayment or restocking policy is recommended as an adopted default. Current cash/gcash/bank/credit enums and legacy automatic restocking are not business approval.

**Required owner response:** choose D4.1 with the table, or D4.2. A choice of D4.1 without its rules is still incomplete approval. Specify eligible states and resulting money/stock/receipt/history outcomes, not just approving Manager authority. No tax, discount, gateway or new accounting feature is introduced.

**Approved policy:** NONE. **Affected work:** payment/completion/reversal application, inventory effects and their positive replay/concurrency/fault tests.

## Account-default contradiction requiring clarification

The continuity prompt says new accounts remain **suspended/unconfirmed** while requiring preservation of approved B02 decisions. B02 completion section 1 and section 2 explicitly record **active/unconfirmed**; accountManagement.js createAccount rejects a suspended new account and writes active/false. Both states deny authenticated access until confirmation, but suspension also requires a separate reactivation path.

Required clarification: retain the documented B02 active/unconfirmed default, or explicitly authorize changing the local provisioning contract to suspended/unconfirmed with the corresponding activation workflow. No change is made until this contradiction is resolved. This is a clarification within B03, not a fifth business role or new roadmap phase.

**Approved clarification:** NONE.

## Approval and implementation boundary

Owner approval must be recorded here verbatim or with a faithful dated policy summary before dependent source edits. Record each selected option, required parameters, scope and any remaining unresolved portion. Do not fill missing answers with assumed defaults.

Existing settled audit rules remain: retain until separately approved purge; Administrator read/no export; atomic applied events; redacted best-effort failed/rejected diagnostics; truthful unknown outcomes/no unsafe replay. Existing account roles/lifecycle/grant security remain authoritative subject to the explicit default clarification above.

No production connection/migration, credential/session operation, deployment, destructive data operation, A08B or next major phase is authorized. Approval of local business contracts does not supply actual data mappings, database verification or release evidence. After decisions are recorded, continue implementation, integration, testing and separate independent acceptance within this same B03 phase.

## Current decision guidance — 2026-11-04

Authority: owner's latest instruction to prepare recommendations, ask essential questions individually, continue independent work and preserve B02 active/unconfirmed. This dated entry supersedes the earlier request to have the owner fill out this sheet. The agent maintains the record; the owner answers individual decisions. Recommendations remain unapproved until the owner responds.

**Approved clarification:** retain B02's active/unconfirmed new-account default. Explicitly confirmed by the owner: "Preserve B02's approved active/unconfirmed account default." The previous account-default clarification is resolved; no runtime change is required.

### Recommended D1 policy — pending approval

Use documented D1.1 / Phase15E section4C: explicit bookstore identity and membership; server-derived scope for new records; preserve original owners, IDs, references and historical prices. Existing records enter shared scope only through explicit reviewed mappings. Unmapped records retain existing owner scope pending review, subject to the separately resolved D2 compatibility boundary. Never automatically merge duplicate SKU/receipt records or guess missing cashier identity. Administrator reporting is limited to authorized bookstore scope; absent attribution is unresolved, not silently assigned. Actual memberships/mappings, collision resolution and production access remain separately gated. Approval of this policy does not approve live IDs or migration.

**Question presented now:** approve this D1 policy, choose the existing explicit allowlist alternative, or revise it. **Response:** PENDING. No D1 runtime change.

### Recommended D2 direction — pending approval

Recommend documented D2.1, a narrowly defined local operational cutover to the four-role ceilings, retaining identities/history/authentication and manual reviewed role assignment. This is the option that can eventually satisfy universal pricing/inventory/reversal restrictions. No automatic user conversion, production cutover or removal of old records. Exact handling of unreviewed users' operational reads/writes will be presented for approval before changing their envelope. Existing D2.2 remains the safe interim state while unanswered: keep compatibility and withhold complete B03 acceptance. This is an agent recommendation from the documented options, not an earlier owner approval.

### Recommended D3 direction — pending approval

Recommend documented D3.1: private per-order possession proof separate from public reference; retain only a verifier where feasible; authenticated customer ownership derives from current B02 User identity. Keep both guest and authenticated modes; no added registration or contact-name identity inference. Use B01's existing minimal status fields (reference/orderStatus) as the proposed tracking projection; no contact/cost/payment/other-customer disclosure. Guest credential transport/lifetime/recovery/rate/reset and staff assignment/fulfillment parameters remain pending. No numerical defaults or new reservation/pickup/cancellation policy are selected. These details will be guided individually rather than delegated to an owner-written specification.

### Minimum D4 owner inputs — ask individually after preceding decisions

Do not ask the owner to design a transaction service. The remaining business inputs reduce to:

1. **Payment scope:** which existing cash/gcash/bank/credit methods are retained for new bookstore sales, and whether credit/partial collection remains operational or historical-only. Existing enums do not supply approval.
2. **Completion timing:** when an order becomes a sale and stock is deducted, whether unpaid orders reserve stock, and how unpaid cancellation differs from a paid reversal. Submission alone is already approved as neither payment nor completion; do not ask that again.
3. **Reversal eligibility and repayment:** which transaction states/amounts may be reversed, full versus partial handling, and the repayment method/evidence for retained payment types. No financial limits or new accounting feature are proposed.
4. **Inventory return:** whether/when refunded or voided items return to saleable stock, including damaged/nonreturned goods. Existing automatic restocking is not policy approval.

Each answer will be translated by the agent into an explicit state/effect table and returned for approval if unresolved consequences remain. Do not implement settlement/reversal effects until applicable rules are approved. Manager approval, Cashier request-only, reasons/audit, original-history preservation, server prices, atomic effects, durable request identity and uncertain-outcome reconciliation are already required; these technical safeguards do not need to become further business questionnaires.

No D4 policy approved. No D1-D3 recommendation is approved by the owner's instruction to prepare recommendations. One question at a time; answers do not require editing this file manually.

## Owner response — 2026-11-04: D1 APPROVED

Owner answered the D1 question: "Approve this D1 policy". Approved: explicit bookstore membership; shared access only to explicitly mapped records; original owners/history preserved; no automatic merging of duplicate SKUs/receipts or guessing missing cashier identities. Unmapped records retain existing owner scope pending review; actual mappings and production access remain separately gated. This supersedes earlier D1 pending status only. B02 active/unconfirmed remains confirmed. D2-D4 remain unapproved.

D2 question now presented individually: approve local cutover retaining legacy user login/self-profile/password and owner-only read access, while denying operational writes until Administrator manual review/canonical assignment. This is a proposed precise envelope under documented D2.1, not approved behavior. No account conversion, history deletion or production cutover is authorized. Response pending.

## Owner response — 2026-11-04: D2 APPROVED

Owner answered: "Approve this local D2 cutover" to the precise proposed envelope. Legacy user accounts retain login, self-profile/password access and read-only access to their own existing records; operational writes are denied until Administrator manual review and assignment to a canonical role. Canonical roles must follow B03 permissions, with existing accounts/history preserved. Production cutover remains separately gated. This supersedes earlier D2 pending status and the broader B02 legacy operational compatibility envelope for this authorized local implementation only. No automatic conversion, live mapping or production execution is approved.

Implementation includes write-capable GET/HEAD receipt ensure paths: existing receipt reads may remain available, but an ensure request must not issue a new receipt for legacy user. D3-D4 remain pending; approval does not activate undefined canonical-role workflows or financial operations.

## Owner response — 2026-11-04: D3 ownership APPROVED

Owner answered: "Approve this D3 ownership design". Guests receive a private unguessable per-order credential separate from public reference; only its verifier is stored; tracking exposes reference/status only. Authenticated students use their current B02 customer account. Both modes remain supported without added registration requirements. Credential lifetime and kiosk reset rules were explicitly excluded from this approval and remain pending, along with unapproved fulfillment/effect details. The next individual question asks credential duration; expiry governs access, not order cancellation or inventory. D4 remains pending and no financial behavior is enabled by D3 approval.

## Owner response — 2026-11-04: guest credential expiry APPROVED

Owner specified: "7 days after issuance." Private guest tracking credentials expire seven days after server issuance. This is access expiry only; it must not cancel orders or change inventory. Kiosk inactivity reset duration is the next individual question; clearing on Finish/New Order or reload and keeping private credentials out of persistent browser storage are proposed privacy handling, not a change to order state. Financial effects remain pending D4.

## Owner response — 2026-11-04: kiosk inactivity APPROVED

Owner specified "5-8 minutes of inactivity" in response to the reset question, which also stated Finish/New Order/page reload clears credential state and a retained copy remains valid for seven days. Local implementation selects five minutes within the approved range. Guest cart and private tracking credential clear from screen/browser memory at expiry; activity restarts the idle interval. This clears local kiosk state only, not the order, inventory or server credential validity. No persistent browser storage of guest credentials is introduced. D4 payment-scope question now presented individually; no D4 policy approved yet.

## Owner response — 2026-11-04: D4 payment scope APPROVED

Owner specified "cash and Gcash full payment only". New bookstore sales support cash and GCash only, with full payment required. No new bank, credit, debt or partial-payment sales are approved. Historical financial records remain preserved; this is not authorization to repair/rewrite existing balances or delete retained methods from historical schemas. Historical collection/application behavior remains subject to the outstanding D4 effect decisions, not automatically enabled by this approval.

Next individual question proposes unpaid kiosk submission with no reservation/deduction, current price/availability recheck and confirmed full payment at authorized cashier completion, with exactly one stock deduction. Revised totals require confirmation before payment. This completion/reservation rule remains PENDING until owner response. Refund/void eligibility, repayment and inventory return effects also remain pending; no financial writer is enabled by payment-method approval alone.

## Owner response — 2026-11-04: sale completion APPROVED

Owner answered "Approve this completion rule". Kiosk submission creates an unpaid order with no reservation or stock deduction. An authorized cashier rechecks current availability and server prices, confirms full cash/GCash payment, and completes the sale with exactly one stock deduction. Price changes require the revised total to be confirmed before payment. This approves the completion/reservation semantics only; refund/void eligibility, repayment and inventory return remain pending. The next individual question asks whole-sale versus partial reversals of completed fully paid sales under Manager approval/reason/audit/replay safeguards.

## Owner responses — 2026-11-04: reversal scope and repayment APPROVED

Owner chose "Whole sale only" for Store Manager-approved refunds/voids of completed fully paid sales. No selected-item or partial financial reversal is approved. Reasons, audit preservation and duplicate-reversal protection remain mandatory.

Owner then answered "Approve original-method repayment": cash refunded as cash, GCash refunded through GCash, with Manager confirmation and a recorded GCash refund reference. The POS records confirmed repayment; it does not initiate a transfer. No gateway integration is authorized. Stock return policy is the next individual question; proposal restocks only Manager-confirmed physically returned saleable quantities, with damaged/nonreturned units excluded even when whole sale is refunded. That stock proposal is pending. No refund writer is enabled until inventory effects and remaining execution consistency are resolved.

## Owner response — 2026-11-04: inventory return APPROVED; D4 core rules settled

Owner answered "Approve condition-based restocking". Whole-sale refund/void restocks only quantities the Manager confirms were physically returned in saleable condition. Damaged/nonreturned units are not restocked even though the financial reversal covers the whole sale.

Approved effect table:
- Kiosk submit: unpaid order; no payment, receipt, reservation or stock deduction.
- Cashier completion: recheck current server prices/availability; require revised-total confirmation on change and confirmed full cash/GCash payment; atomically complete sale, deduct stock once and record receipt/payment/audit/operation identity.
- Whole-sale paid reversal: Manager approval/reason; full original-method repayment confirmation; GCash refund reference required; preserve original sale/payment/receipt history; append reversal and Manager-confirmed saleable return movements. No partial financial reversals.
- Reversal replay/conflict: one financial/inventory effect only; conflicting command reuse rejects; unknown outcomes reconcile, never blindly repeat transfers or stock effects.

These are local policies, not executed financial operations or production approval. No new financial limits, tax, discount, purchasing/gateway integration or audit-retention duration is approved. Unpaid cancellation authorization/fulfillment scope and guest transport/rate/recovery details remain separate unresolved subparts where needed; do not silently treat them as approval of new actions.

## Owner response — 2026-11-04: fulfillment scope APPROVED

Owner answered "Approve this fulfillment workflow". Cashiers in the authorized bookstore may view a minimal unpaid-order queue (reference/items/total, no customer contact data), atomically claim an unassigned order, and complete only self-assigned orders. Managers may oversee all bookstore orders. Customer/guest tracking remains own-order reference/status only. This resolves the assigned-order queue/claim scope; it does not grant peer completed-sale history or unrestricted PII. Unpaid cancellation is not automatically equated to paid reversal; no new cancellation authority is inferred.

## Owner response — 2026-11-04: unpaid cancellation APPROVED

Owner answered "Approve Manager-only unpaid cancellation". Only Store Manager may cancel unpaid orders, with required reason and audit. Cancellation has no payment, refund, reservation or stock effect and is separate from completed-sale refund/void. This resolves the previously isolated cancellation subpart of D4; no customer/cashier cancellation authority is inferred.

## Owner response — 2026-11-04: NEW record monetary encoding APPROVED

Owner answered "Approve integer centavos for new B03 records" after source inspection exposed product-entry/receipt unit inconsistency. New B03 monetary records use integer PHP centavos; interface displays pesos (PHP150.50 ->15050). Existing amounts remain unchanged; no historical reinterpretation/conversion is approved. Scoped sale writers must require explicit verified monetary-unit attribution and fail closed on unmapped/unverified legacy amounts. This is not a data repair or migration authorization.


## Final local implementation disposition — 2026-11-04

D1, D2, D3 and D4 core policies and required subdecisions above are owner-approved and implemented locally. No further owner business decision was inferred. B02 active/unconfirmed remains the authoritative creation default. Five minutes is the implementation selection within the owner's approved5–8-minute kiosk range. The private credential lifetime remains seven days.

Implementation and independent local acceptance do not approve actual historical mappings, monetary conversion/processor inference, production access, index installation, native fault testing, database recovery, production cutover, deployment, A08B or another phase. Internal mapping preparation/rehearsal is synthetic; actual exact-ID mapping manifests and target/backup/recovery evidence remain separately gated. No audit-retention duration or financial limit was added.
