"""Build documentation from offline metadata plus source-reviewed findings."""
import json
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent.parent
D = json.loads((OUT / 'schema-metadata.json').read_text())
MODELS = D['models']
BY_NAME = {m['model']: m for m in MODELS}

def evidence(file, needle=None):
    p = ROOT / file
    lines = p.read_text(encoding='utf-8-sig').splitlines()
    line = next((i for i, s in enumerate(lines, 1) if needle and needle in s), 1)
    return f'[{file}:{line}](../../{file}#L{line})'

def model_file(name):
    for p in (ROOT / 'backend/models').glob('*.js'):
        if re.search(r'\bmodel\([\"\x27]' + re.escape(name) + r'[\"\x27]', p.read_text(encoding='utf-8')):
            return p.relative_to(ROOT).as_posix()
    raise ValueError(name)

def evmodel(name):
    return evidence(model_file(name), f'"{name}"' if name != 'Financial' else "'Financial'")

def cell(value):
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return str(value).replace('|', '&#124;').replace('\n', '<br>').replace('\r', '')

def table(headers, rows):
    return '| ' + ' | '.join(headers) + ' |\n|' + '|'.join('---' for _ in headers) + '|\n' + ''.join('| ' + ' | '.join(cell(x) for x in row) + ' |\n' for row in rows) + '\n'

PURPOSE = {
'User':'Authentication accounts, business roles, security versions, and explicit store memberships.',
'Store':'Bookstore identity, category labels, creator, and compatibility customer used for bookstore orders.',
'Customer':'Owner-scoped customer/contact records, including the bookstore placeholder contact; independent of login accounts.',
'Product':'Catalog, prices, aggregate stock, optional clothing size quantities, and archival availability.',
'Transaction':'Pending orders and completed sales, embedded item snapshots, payments summary, cashier assignments, cancellations, and reversal linkage.',
'Invoice':'Receipt/invoice identity, transaction/customer linkage, status, optional immutable-by-convention sale snapshot, and reversal pointer.',
'InvoiceCounter':'Legacy owner/type/year invoice-number counter.',
'DebtPayment':'Legacy customer debt settlements; may reference one transaction or represent a settlement distributed across several transactions.',
'Expense':'Owner/creator expense records used by legacy expense endpoints.',
'Financial':'Apparently unused financial-summary model with its own embedded expense records; not loaded by app.js.',
'AccountAuditEvent':'Append-only account/permission administration event ledger.',
'ConditionalAccountGrant':'Explicit, expiring, scoped conditional capabilities tied to recipient security and grantor authority versions.',
'AccountRoleReview':'Independent account-role review decisions and revision/supersession history.',
'AccountOperationReceipt':'Account command idempotency identity, private fingerprint, and stored result.',
'AccountAdministrationRealm':'Shared account-administration serialization record; application uses string ID account-management.',
'BookstoreAuditEvent':'Append-only scoped operational events for account and guest actors, including queue-removal markers.',
'BookstoreOperationReceipt':'Append-only scoped operation idempotency/reconciliation record and response DTO.',
'StockMovement':'Append-only aggregate stock deltas with optional embedded clothing-size deltas.',
'BookstorePayment':'Append-only full cash/GCash payment record; one declared unique transactionId.',
'BookstoreReversalRequest':'Request and approval/application state for reversal of a fully paid sale.',
'BookstoreSaleReversal':'Append-only whole-sale repayment record, request pointer, and embedded return selections.',
'GuestOrderIntent':'Guest proof verifier and store context, created before submission; its ID becomes the guest transaction ID.',
'BookstoreSequence':'Store/year receipt-number counter with declared unique store/year pair.',
}

DESC = {
'_id':'Primary document identifier; generated ObjectId unless an explicit type/value is supplied.',
'__v':'Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee.',
'createdAt':'Creation timestamp managed by Mongoose timestamps unless separately declared.',
'updatedAt':'Last update timestamp managed by Mongoose timestamps.',
'owner':'Historical owner account; owner-scoped compatibility access. Not equivalent to store membership.',
'userId':'Owning account reference.', 'customer':'Customer/contact linked to the transaction, invoice, or payment.',
'storeId':'Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas.',
'moneyUnit':'Explicit PHP-centavos monetary marker; absent historical values are not automatically converted.',
'identifier':'Account login identifier; lowercased by account commands/login, unique index declared.',
'password':'Password hash persisted by save middleware after password validation and bcrypt hashing; no values included in this audit.',
'role':'Stored account role; user denotes a legacy unassigned account.',
'name':'Display name of the account, store, customer, product, or sold product snapshot.',
'phone':'Contact phone; User has a sparse unique index, Customer does not.',
'address':'Contact postal/address text.', 'email':'Customer email text; not declared on User.',
'storeIds':'Mixed value validated as a dense, duplicate-free BSON ObjectId array of explicit store memberships.',
'confirmed':'Account confirmation flag, validated as Boolean without casting.',
'accountState':'Account active/suspended state retained as Mixed to reject malformed persisted values.',
'authorityVersion':'Nonnegative safe-integer authority epoch advanced on authority changes.',
'tokenVersion':'Nonnegative safe-integer authentication/security epoch advanced on security changes.',
'categoryNames':'Embedded list of category labels; not a Category collection.',
'createdBy':'Creator account reference.', 'orderCustomer':'Placeholder Customer used for guest/student/POS bookstore order compatibility.',
'sku':'Product stock-keeping code; neither schema nor normal catalog command declares uniqueness.',
'price':'Product sale price; bookstore services require integer PHP centavos.',
'stock':'Aggregate available quantity; bookstore service enforces safe integers and stock consistency.',
'sizeStocks':'Mixed embedded size-to-quantity object, validated against supported clothing sizes and aggregate stock.',
'category':'Product/category label or Expense category enum, as shown in the structure table.',
'isActive':'Catalog availability/archive flag.', 'imageUrl':'Optional product photo; creation service validates data URL/image contents.',
'costPrice':'Declared product cost with min 0; no dedicated operational writer found; excluded from staff sale projection.',
'isDeleted':'Customer soft-deletion flag.', 'deletedAt':'Customer soft-deletion timestamp.',
'items':'Embedded sale/order lines; not a separate collection. Item snapshots retain names/prices at sale.',
'items[].product':'Product ObjectId reference inside an embedded item.',
'items[].quantity':'Number of units ordered/sold; schema min 1, bookstore commands require positive safe integer.',
'items[].unitPrice':'Per-unit selling price snapshot.', 'items[].subtotal':'Line subtotal; services calculate quantity × unitPrice. Schema hook preserves an already supplied subtotal.',
'items[].name':'Product name snapshot.', 'items[].sku':'Product SKU snapshot.', 'items[].category':'Product category snapshot.',
'items[].size':'Selected clothing size, when applicable.',
'totalAmount':'Sum of embedded item subtotals, recomputed in transaction pre-validation.',
'amountPaid':'Paid amount; transaction middleware clamps to [0,totalAmount]; DebtPayment records a settlement amount.',
'balance':'Remaining transaction balance recomputed from totalAmount minus amountPaid.',
'paymentStatus':'Transaction paid/partial/debt/unpaid classification; derived for completed transactions.',
'paymentMethod':'Payment method; broader legacy enum than bookstore payment ledger.',
'paymentReference':'External payment reference text; no uniqueness declaration.',
'customerType':'Legacy customer/channel classification; bookstore origin is stored separately.',
'reference':'Legacy order reference or operational payment/refund reference, depending on collection; no uniqueness declaration.',
'orderStatus':'Pending/completed/void/cancelled lifecycle; reversal does not introduce a reversed enum value.',
'ledgerRecorded':'Flag indicating completion effects were applied; used with lifecycle eligibility checks.',
'completedAt':'Sale completion timestamp.', 'processedBy':'Account that completed the sale.',
'origin':'Order channel guest/student/pos; missing indicates legacy order.',
'directPayment':'Cashier direct-checkout marker; absent on other/historical orders.',
'studentUser':'Authenticated customer/student account linkage; excluded from ordinary query selection.',
'assignedTo':'Account assigned to fulfill/process a pending order.',
'bookstoreReference':'Generated public UPH-XXXX-XXXX order reference; sparse unique index declared.',
'cancelledAt':'Pending-order cancellation timestamp.', 'cancelledBy':'Account that cancelled the pending order; application reference without ref metadata.',
'cancellationReason':'Pending-order cancellation reason.', 'reversalId':'Applied BookstoreSaleReversal identifier; application reference without ref metadata.',
'reversedAt':'Timestamp when the sale reversal was applied.', 'notes':'Free-text notes.',
'voidedAt':'Legacy void timestamp read by filters and invoice synchronization; no current writer found.',
'voidReason':'Legacy void reason; no current writer found.',
'transaction':'Transaction ObjectId reference; optional on customer-wide DebtPayment records.',
'invoiceNumber':'Human-readable invoice/receipt number; no unique schema index.',
'issuedAt':'Invoice issuance timestamp.', 'dueDate':'Optional invoice due date; legacy creation sets seven days ahead for debt or null for paid sales.',
'status':'Lifecycle/review state; allowed values appear in the structure table.',
'snapshot':'Mixed embedded receipt DTO produced at bookstore completion; no nested schema enforcement.',
'paidAt':'Debt payment timestamp.', 'type':'Invoice counter namespace, or embedded legacy financial expense type.',
'year':'Calendar year counter partition; bookstore receipt year uses Asia/Manila.',
'seq':'Current sequential counter value.', 'itemName':'Expense item description.',
'amount':'Expense/payment/refund amount; integer PHP centavos enforced for operational ledgers.',
'note':'Expense free-text note.', 'date':'Expense occurrence date.',
'capitalInvested':'Declared capital amount in apparently unused Financial model; operational purpose requires verification.',
'grossIncome':'Declared gross income in apparently unused Financial model; calculation/writer requires verification.',
'netIncome':'Declared net income in apparently unused Financial model; calculation/writer requires verification.',
'expenses':'Embedded expense array in Financial; independent of expenses collection.',
'expenses[].type':'Embedded financial expense classification text.', 'expenses[].amount':'Embedded financial expense amount.',
'expenses[].date':'Embedded financial expense occurrence date.', 'expenses[]._id':'Mongoose-generated identifier of the embedded financial expense, not an independent collection identifier.',
'schemaVersion':'Account audit format version; enum restricts to 1.', 'eventId':'Unique account audit event identity.',
'operationId':'Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index.',
'sequence':'Event sequence within an operation.',
'actor.id':'Account actor ID; conditionally required for kind account; no ref metadata.',
'actor.role':'Role at time of account event; conditionally required for account actors.',
'actor.kind':'Account or system-expiry audit actor classification.',
'subjectAccountId':'Account whose state/permissions were audited; reference may survive account deletion.',
'action':'Recorded account or bookstore action from the declared enum.',
'occurredAt':'Ledger event occurrence timestamp.',
'reason':'Required audit/operation justification; setters redact sensitive text.',
'before':'Mixed previous-state projection, or numeric stock before movement.',
'after':'Mixed next-state projection, or numeric stock after movement.',
'scope':'Mixed bounded authority/audit context; its shape is validated or constructed in account services.',
'approvalRef':'Approval evidence reference; grant service requires it although grant schema does not.',
'reviewId':'Associated AccountRoleReview ID; application reference without ref metadata.',
'grantId':'Associated ConditionalAccountGrant ID; application reference without ref metadata.',
'securityVersionBefore':'Account security epoch before administrative mutation.',
'securityVersionAfter':'Account security epoch after administrative mutation.',
'outcome':'Applied account mutation or observed grant expiry.',
'recipientAccountId':'Account receiving a conditional permission.', 'capability':'Capability name; validated against capability policy in grant service, not a schema enum.',
'grantedBy':'Grantor account.', 'effectiveAt':'Start of grant validity.', 'expiresAt':'End of grant validity; no TTL index declared.',
'recipientVersion':'Recipient security epoch to which the grant is bound.',
'grantorAuthorityVersion':'Grantor authority epoch to which the grant is bound.',
'revokedAt':'Mixed null-or-Date revocation state; default null only for new documents.',
'revokedBy':'Revoking account identifier; application reference without ref metadata.',
'revocationReason':'Why grant was revoked.', 'expiredRecordedAt':'Timestamp when expiry was materialized into the audit ledger.',
'targetAccountId':'Account under independent role review.', 'reviewerId':'Account performing the role review.',
'proposedRole':'Proposed approved business role; excludes legacy user.',
'expectedVersion':'Expected target security epoch to detect stale review/application.',
'expectedRole':'Target role snapshot checked when applying review.', 'evidenceRefs':'Embedded review-evidence reference strings, sanitized by setter.',
'revision':'Review revision counter.', 'supersedes':'Prior AccountRoleReview ID; application reference without ref metadata.',
'verifiedAuthorityVersion':'Authority epoch recorded on an applied independently verified administrator review.',
'actorId':'Account command/payment/movement actor identifier; account audit counterpart is actor.id.',
'targetId':'Account operation target, or polymorphic bookstore event target; meaning depends on collection/targetKind.',
'fingerprint':'Private keyed command digest for operation replay/conflict checks; select:false.',
'result':'Mixed persisted command response DTO for replay/reconciliation; shape varies by command.',
'revision':'Realm write-fence revision or role-review revision counter, depending on collection.',
'actorKey':'Discriminated actor string account:<id> or guest:<intentId>; part of scoped operation identities.',
'actorKind':'Bookstore audit actor classification account/guest.',
'targetKind':'Polymorphic target discriminator; Reversal names either request or applied reversal by action.',
'productId':'Product identifier on stock movement; application reference without ref metadata.',
'delta':'Signed, nonzero stock quantity change.', 'source':'Movement origin adjustment/sale/return.',
'transactionId':'Transaction identifier on an operational ledger/counterpart record; application reference without ref metadata.',
'sizeChanges':'Embedded size-level before/after/delta rows, with no embedded _id.',
'sizeChanges[].size':'Affected clothing size.', 'sizeChanges[].before':'Quantity for this size before movement.',
'sizeChanges[].after':'Quantity for this size after movement.', 'sizeChanges[].delta':'Signed nonzero change for this size.',
'method':'Cash/GCash payment or repayment method.', 'requestedBy':'Account requesting reversal.',
'approvedBy':'Account approving/applying reversal.', 'appliedAt':'Reversal request application timestamp.',
'requestId':'BookstoreReversalRequest identifier used for an applied sale reversal.',
'returned':'Embedded Mixed array of product/quantity/optional size selections actually returned to stock; empty array permitted by service.',
'verification':'Private Mixed guest verifier object; digest/issuedAt/expiresAt constructed and checked in guestOrderAccess.',
}

def describe(m, f):
    key = f['path']
    if m['model'] == 'AccountAdministrationRealm' and key == '_id':
        return 'String document identifier; accountManagement uses account-management as its shared write-fence record.'
    if m['model'] == 'Transaction' and key == 'createdAt':
        return 'Explicit indexed creation date with Date.now default; timestamp option only manages updatedAt.'
    return DESC.get(key, 'Purpose requires verification; no confident description established beyond the declared field name.')

def required(f):
    value = f['options'].get('required', False)
    return 'Conditional: ' + value if isinstance(value, str) else ('Yes' if value else 'No')

def default(f):
    if 'default' in f['options']:
        v = f['options']['default']
        return 'undefined (explicit)' if v == '<undefined>' else json.dumps(v) if not isinstance(v,str) else ('""' if v == '' else v)
    if f['path'] == '__v': return '0 (Mongoose version key)'
    if f['path'] in ('createdAt','updatedAt') and f['type'] == 'Date': return 'No declared default; timestamp middleware'
    if f['options'].get('auto'): return 'Generated ObjectId (Mongoose)'
    if 'implicitDefault' in f: return f['implicitDefault']
    return 'None declared'

lines = ['# UPHSD BookstorePOS — actual database schema audit\n',
'Audit date: 2026-11-11 (Asia/Manila). Scope: current on-disk implementation, including pre-existing uncommitted changes. Read-only source inspection; only documentation artifacts were written. No environment values were read or published, no application listener started, and no database connection/query/index creation/migration/seed ran.\n',
'## 1. Database Overview\n',
'**23 model declarations map to 23 distinct collection names. The application import graph registers 22 of them; `Financial`/`financials` is defined but not loaded by `backend/app.js`. These are code-resolved collection names, not a live collection inventory. Actual physical collection existence, counts, contents, and deployed indexes were not verified.**\n',
'There is no independent Order, Person, TransactionItem, Category, Payment (generic), or Reversal (generic) model. `Order.js` registers `Transaction`; `Person.js` registers `Customer`. Account and bookstore control files each register multiple models.\n',
'## 2. Database Technology\n',
f'MongoDB with Mongoose. Installed Mongoose inspected offline: **{D["mongooseVersion"]}**; dependency declares `^9.3.3`. Native `mongodb` and `pg` are dependencies, but no separate PostgreSQL schema/connection or alternative persistence model was found in application source. '+evidence('backend/package.json','"dependencies"')+'\n',
'Startup loads dotenv, creates the Express app/listener, then calls `connectDB()`. Configuration uses `mongoose.connect(process.env.MONGO_URI)` with no explicit database/collection override. The database name, server version/topology, environment-specific auto-index behavior, and production configuration are unverified. '+evidence('backend/index.js','dotenv.config')+'; '+evidence('backend/config/config.js','mongoose.connect')+'\n',
'All model names below were resolved with the installed Mongoose pluralizer. No custom collection override, discriminator, pluralizer change, raw collection creation, or additional model registration was found in project source. Model-only/offline import disables autoCreate/autoIndex and blocks connect/createConnection; connection readyState remained 0. `app.js` import has no listener or connection side effects. '+evidence('backend/app.js','No listener')+'\n',
'## 3. Complete Collection Inventory\n']
lines.append(table(['Collection name','Registered model','Loaded through app.js','Purpose','Registration evidence'], [(m['collection'],m['model'],'Yes' if m['loadedByApp'] else 'No — declaration only',PURPOSE[m['model']],evmodel(m['model'])) for m in MODELS]))
lines += ['## 4. Collection Structures\n',
'All defined persisted paths, including automatic `_id`, `__v`, timestamp fields, plugin-added attribution, nested paths, and embedded array paths, appear below. `id` and named virtual aliases are not persisted fields. `Mixed` is the actual schema type even when service logic expects an ObjectId, Boolean, integer, or structured object. Required subfields apply to existing elements; an array itself need not be nonempty.\n',
'Index tables list **declared** indexes only. `_id` is MongoDB’s primary document identity (normally uniquely indexed on ordinary collections); its server index was not inspected. `unique:true` declares an index, not a Mongoose validator or foreign-key constraint. No guarantee is made that deployed indexes were created.\n']
for m in MODELS:
    name=m['model']
    lines += [f'### {m["collection"]} — `{name}`\n', PURPOSE[name]+' '+evmodel(name)+'\n',
              'Schema options: `'+json.dumps(m['options'],separators=(',',':'))+'`. Virtuals (not columns): `'+', '.join(m['virtuals'])+'`.\n']
    rows=[]
    for f in m['fields']:
        o=f['options']
        rules={k:v for k,v in o.items() if k not in ['required','default','enum','unique','sparse','index','ref','auto']}
        rows.append([f['path'],f['type'],required(f),default(f),o.get('enum','—'),'Yes (declared index)' if o.get('unique') else 'No field-level unique declaration',o.get('ref','—'),rules or '—'])
    lines.append(table(['Field','Type','Required','Default','Enum','Unique','Mongoose ref model','Other declared rules/setters'],rows))
    lines.append(table(['Index keys (order retained)','Options'],[(json.dumps(keys,separators=(',',':')),opts or '{}') for keys,opts in m['indexes']]) if m['indexes'] else 'No secondary indexes declared.\n')
    if name in ['Product','Customer','Transaction','Invoice','DebtPayment']:
        lines.append('`storeId` and its validator/index are added by '+evidence('backend/models/resourceAttribution.js','export function addStoreAttribution')+'. `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.\n')

# Relationship rows: explicit Mongoose refs first, followed by code-verified logical links.
relationships=[]
for m in MODELS:
    for f in m['fields']:
        target=f['options'].get('ref')
        if target:
            cardinality='Many source documents → one target (required identifier; target existence not schema-enforced)' if f['options'].get('required') else 'Many source documents → zero/one target'
            relationships.append([m['collection'],f['path'],BY_NAME[target]['collection'],'_id',cardinality,'ObjectId ref inside embedded array' if '[]' in f['path'] else 'ObjectId with Mongoose ref',evmodel(m['model'])])

def relation(source,field,target,kind,card,file,needle):
    relationships.append([BY_NAME[source]['collection'],field,BY_NAME[target]['collection'],'_id',card,kind,evidence(file,needle)])

relation('User','storeIds[]','Store','Mixed array validated as BSON ObjectIds; no ref','Many-to-many; no join collection','backend/services/accountManagement.js','export async function replaceStoreMemberships')
for source in ['Product','Customer','Transaction','Invoice','DebtPayment']:
    relation(source,'storeId','Store','Mixed BSON ObjectId; no ref','Many sources → zero/one Store; historical absence permitted','backend/services/bookstoreMapping.js','async function inspect')
for source in ['BookstoreAuditEvent','BookstoreOperationReceipt','StockMovement','BookstorePayment','BookstoreReversalRequest','BookstoreSaleReversal','GuestOrderIntent','BookstoreSequence']:
    relation(source,'storeId','Store','ObjectId without ref','Many sources → one Store by application convention','backend/services/guestOrders.js' if source=='GuestOrderIntent' else 'backend/services/bookstoreOrders.js' if source in ['BookstorePayment','BookstoreReversalRequest','BookstoreSaleReversal','BookstoreSequence'] else 'backend/services/sizeInventory.js' if source=='StockMovement' else 'backend/services/bookstoreCommand.js','GuestOrderIntent.create' if source=='GuestOrderIntent' else 'StockMovement.create' if source=='StockMovement' else 'storeId')
for source,field in [('BookstoreAuditEvent','actorId'),('StockMovement','actorId'),('BookstorePayment','actorId'),('BookstoreReversalRequest','requestedBy'),('BookstoreReversalRequest','approvedBy'),('BookstoreSaleReversal','approvedBy'),('Transaction','cancelledBy')]:
    relation(source,field,'User','ObjectId without ref','Many → one account; optional for guest actor / not-yet-approved request / uncancelled order','backend/services/sizeInventory.js' if source=='StockMovement' else 'backend/services/bookstoreCommand.js' if source=='BookstoreAuditEvent' else 'backend/services/bookstoreOrders.js',field)
for source,card in [('StockMovement','Many movements → zero/one transaction'),('BookstorePayment','One transaction → zero/one payment; unique transactionId index declared'),('BookstoreReversalRequest','One transaction → many requests; no unique transactionId'),('BookstoreSaleReversal','One transaction → zero/one reversal; unique transactionId index declared')]:
    relation(source,'transactionId','Transaction','ObjectId without ref',card,'backend/services/sizeInventory.js' if source=='StockMovement' else 'backend/services/bookstoreOrders.js','transactionId')
relation('BookstoreSaleReversal','requestId','BookstoreReversalRequest','ObjectId without ref','Many → one by schema; service applies a request once; requestId is not unique','backend/services/bookstoreOrders.js','SaleReversal.create')
for source in ['Transaction','Invoice']:
    relation(source,'reversalId','BookstoreSaleReversal','ObjectId without ref','Many → zero/one by schema; one sale/invoice linkage in normal completion/reversal flow','backend/services/bookstoreOrders.js','order.reversalId = reversal._id' if source=='Transaction' else 'invoice.reversalId = reversal._id')
relation('StockMovement','productId','Product','ObjectId without ref','Many movements → one product','backend/services/sizeInventory.js','StockMovement.create')
relation('BookstoreSaleReversal','returned[].productId','Product','String identifier inside embedded Mixed row','Many-to-many over embedded returned selections; no join collection','backend/services/bookstoreOrders.js','seen.add(key); returned.push')
relation('Invoice','snapshot.items[].productId','Product','String identifier inside embedded Mixed receipt DTO','Many snapshots → many products; historical copy, not live price data','backend/services/bookstoreOrders.js','export const itemDto')
relation('GuestOrderIntent','_id','Transaction','Shared ObjectId identity; no ref','One intent → zero/one submitted guest transaction; non-guest transactions have no intent','backend/services/guestOrders.js','orderId: intent._id')
relation('AccountAuditEvent','actor.id','User','ObjectId without ref','Many events → zero/one account actor; system-expiry has no account','backend/services/accountManagement.js','actor: { id: actorId')
for source,field,target,needle in [('AccountAuditEvent','reviewId','AccountRoleReview','reviewId: review._id'),('AccountAuditEvent','grantId','ConditionalAccountGrant','grantId: grant._id'),('ConditionalAccountGrant','revokedBy','User','grant.revokedBy = user._id'),('AccountRoleReview','supersedes','AccountRoleReview','const previous = await AccountReview.findById')]:
    relation(source,field,target,'ObjectId without ref','Many sources → zero/one target; historical links may outlive target account','backend/services/accountManagement.js',needle)
relation('AccountAuditEvent','scope.accountId','User','Application-generated identifier inside Mixed scope','Many audit events → account context; capability events instead use grant scope','backend/services/accountManagement.js','scope: { kind: "account-realm"')
for target,needle in [('Product','const Model = productScope ? Product : Order'),('Transaction','const Model = productScope ? Product : Order'),('User','if (rule.scope === "own-processor")')]:
    relation('ConditionalAccountGrant','scope.resourceIds[] (capability-dependent)',target,'String IDs inside Mixed scope','Many-to-many bounded application scope; target type depends on capability','backend/services/accountManagement.js',needle)
for target,needle in [('User','const actorKey = `account:'),('GuestOrderIntent','const actorKey = `guest:')]:
    for source in ['BookstoreAuditEvent','BookstoreOperationReceipt']:
        relation(source,'actorKey',target,'Discriminated string account:<id> or guest:<id>','Many records → one actor identity by prefix; no ref','backend/services/bookstoreCommand.js' if target=='User' else 'backend/services/guestOrders.js',needle)

lines += ['## 5. Database Relationships\n',
'Cardinalities describe stored identifiers and verified writer behavior, not referential enforcement. MongoDB does not automatically ensure target existence, ownership equality, or cascade deletion. `required` ensures a value only when applicable Mongoose validation runs. Declared unique indexes limit duplicate identifier values only if deployed. All target fields below are `_id` unless explicitly stated.\n', table(['Source collection','Source field','Referenced collection','Referenced field','Relationship/cardinality','Representation','Evidence'],relationships),
'Additional polymorphic event targets: `bookstoreauditevents.targetId` is resolved by `targetKind` and action: Store→stores; Product→products; Transaction→transactions; Invoice→invoices; GuestIntent→guestorderintents; Customer→customers; DebtPayment→debtpayments. **Reversal is ambiguous without action:** `reversal.requested` uses bookstorereversalrequests, while `reversal.applied` uses bookstoresalereversals. These discriminator strings are not model registrations or foreign keys. '+evidence('backend/models/BookstoreControl.js','targetKind')+'; '+evidence('backend/services/bookstoreOrders.js','"reversal.requested"')+'; '+evidence('backend/services/bookstoreOrders.js','"reversal.applied"')+'\n',
'Transactions↔Products is a verified many-to-many association through `transactions.items[].product`, embedded within each transaction. It is not a separate line-item collection. Invoice→Transaction is many-to-one at schema level (multiple invoices allowed per transaction); service lookup/issuance intends one invoice per sale, without a unique index. Store→orderCustomer is a single reference, but no unique constraint prevents different stores from selecting the same Customer. There is no verified automatic User↔Customer identity mapping: bookstore orders use `Store.orderCustomer`; authenticated students are recorded separately in `Transaction.studentUser`.\n',
'`operationId` correlates audit rows, operation receipts, stock movements, grants, reviews, payments, and reversals by command context. It is a string, not an ObjectId ref. Bookstore audit↔receipt correlation uses `(actorKey, operationId)`, and account audit↔receipt uses `operationId`; not every audit event has a corresponding receipt (e.g. intent issuance/expiry materialization). DTO result/snapshot IDs are copies and are not additional collections.\n',
'## 6. Embedded Documents\n']
embedded=[
('transactions','items[]','product, quantity, unitPrice, name, sku, category, size, subtotal','Sold/order product and price snapshots; _id:false','items[].product → Product ref','backend/models/Order.js','const transactionItemSchema'),
('financials','expenses[]','_id, type, amount, date','Independent legacy expense subdocuments; automatic child _id','None; not references to expenses','backend/models/Financial.js','const expenseSchema'),
('stockmovements','sizeChanges[]','size, before, after, delta','Size-level delta ledger; _id:false; optional undefined','None; labels link to product sizeStocks by convention','backend/models/BookstoreControl.js','sizeChanges:'),
('accountauditevents','actor','id, role, kind','Plain nested object, no child _id','actor.id → User in account service, no ref','backend/models/AccountControl.js','actor: {'),
('stores','categoryNames[]','String elements','Category labels, not independent entities','Product.category matches label in application','backend/services/categoryService.js','function namesFor'),
('accountrolereviews','evidenceRefs[]','String elements','Sanitized independent review evidence references','Not database ref values','backend/models/AccountControl.js','evidenceRefs:'),
('users','storeIds','Mixed expected as ObjectId[]','Validated membership list','Store IDs; no Mongoose ref','backend/models/resourceAttribution.js','export function isStoredMemberships'),
('products','sizeStocks','Supported size keys XS,S,M,L,XL,2XL,3XL,4XL → nonnegative safe integers','Mixed nonempty size map; sum equals stock when present','No collection reference','backend/utils/clothingSizes.js','export function validSizeStocks'),
('invoices','snapshot','orderId, reference, orderStatus, total, moneyUnit, items[], assignedTo, invoiceNumber, issuedAt, paymentMethod, paymentReference, cashierId','Mixed receipt DTO; item fields productId, optional size, name, sku, quantity, unitPrice, subtotal','String order/product/cashier IDs inside copy','backend/services/bookstoreOrders.js','const snapshot ='),
('bookstoresalereversals','returned[]','productId (String), quantity (Number), optional size (String)','Array<Mixed>; service restricts selections to sold quantities/product/size; empty list allowed','Product ID strings, no ref','backend/services/bookstoreOrders.js','seen.add(key); returned.push'),
('guestorderintents','verification','digest (String), issuedAt (Date), expiresAt (Date)','Mixed verifier, select:false; no stored raw credential; seven-day lifetime checked by code','Identity tied to parent intent ID by digest construction','backend/auth/guestOrderAccess.js','verification: {'),
('conditionalaccountgrants','scope','kind, resourceIds[]','Mixed; grant service requires exact shape and 1–100 unique bounded IDs','User/Product/Transaction depending on capability','backend/services/accountManagement.js','async function validateScope'),
('accountauditevents','before, after, scope','Open Mixed projections; ordinary scope kind=account-realm/accountId; grant events use grant scope','Account state snapshots and authority context; no fixed nested schema','May include account/grant/review identifiers','backend/services/accountManagement.js','const audit = async'),
('bookstoreauditevents','before, after','Open Mixed; command-specific state snapshots, e.g. stock, lifecycle, returned[], deleted, visibleInQueue','Operational projection rejects protected keys/nonplain objects and sanitizes text','Target-dependent copied IDs only','backend/auth/operationalProjection.js','export function operationalProjection'),
('accountoperationreceipts, bookstoreoperationreceipts','result','Open Mixed; command-specific response DTO','Idempotent replay response, not a stable universally defined sub-schema','May contain account/order/invoice/product/grant/review/reversal IDs','backend/services/bookstoreCommand.js','const response ='),
]
lines.append(table(['Parent collection','Embedded path','Internal structure','Purpose/validation','References','Evidence'],[(a,b,c,d,e,evidence(f,g)) for a,b,c,d,e,f,g in embedded]))
lines += ['Mixed values remain open in the schema. The shapes above document current writer behavior, not exhaustive schema restrictions on arbitrary historical data. Scalar Mixed fields (confirmed, accountState, versions, moneyUnit, storeId, revokedAt) are not independent embedded entities.\n',
'## 7. Database Constraints and Validation\n',
'### 7.1 Schema-declared rules\n',
'Section 4 preserves every declared required/default/enum/unique/index/min/max/length/selection/setter/custom-validator option. No max numeric validator is declared in these schemas. Important custom and middleware rules follow.\n']
constraints=[
('User','isTokenVersion validates nonnegative safe integers; confirmed must be Boolean; accountState active/suspended; storeIds dense unique ObjectId array. Optional validators do not make missing fields required. New roles/confirmation/state defaults depend on isNew; new tokenVersion/authorityVersion are initialized to 0 by pre-validate, not field defaults.','backend/models/User.js','UserSchema.pre("validate"'),
('User','Pre-save rejects uncontrolled security/authority epoch changes, increments security epoch for password/role/confirmation/state/membership changes and authority epoch for authority changes, uses an expected epoch update condition, and hashes changed passwords. Post-save clears local tracking. Password validation is length >=6 characters and <=72 UTF-8 bytes; bcrypt cost 10. Query/raw writes do not automatically execute document save hooks.','backend/models/User.js','UserSchema.pre("save"'),
('Product','When sizeStocks exists, validSizeStocks requires nonempty plain object of supported size keys and nonnegative safe integer values, safe sum, and sum == stock. Product schema alone only min-checks price/stock/costPrice, not safe-integer checks for each scalar.','backend/models/Product.js','productSchema.pre'),
('Transaction','Pre-validate normalizes item numbers, supplies missing subtotal (does not overwrite an existing one), sums subtotals, clamps paid amount, calculates balance, and derives paid/partial/debt for completed orders. It does not generally enforce subtotal == quantity*unitPrice for explicitly supplied subtotals.','backend/models/Order.js','transactionSchema.pre'),
('Transaction → Invoice','Post-save updates one invoice matching owner+transaction with mapped payment status or void. Does not create invoice, ensure invoice uniqueness, or synchronize all duplicate invoices. The hook is not triggered by arbitrary query updates.','backend/models/Order.js','transactionSchema.post'),
('Resource attribution','storeId is optional Mixed validated as a canonical BSON ObjectId. moneyUnit is optional Mixed validated as PHP-centavos. Applied to Product, Customer, Transaction, Invoice, DebtPayment; moneyUnit excluded on Customer. Both are absent by default.','backend/models/resourceAttribution.js','export function addStoreAttribution'),
('Account audit','strict:throw, versionKey:false, unique eventId and (operationId,sequence), reason max length 1024, actor fields conditionally required, audit state/scope Mixed required. Append-only middleware rejects subsequent save and declared query update/delete/replace/bulkWrite operations.','backend/models/AccountControl.js','for (const operation'),
('Conditional grant','Mixed epoch validators; revokedAt accepts null or finite Date with new-document-only null default; strict:throw; timestamps. No schema date-order validator, capability enum, scope shape validator, approvalRef required flag, or TTL declaration.','backend/models/AccountControl.js','const grant ='),
('Operational ledgers','BookstoreAudit, StockMovement, BookstoreReceipt, BookstorePayment and SaleReversal use appendOnly middleware. It covers listed Mongoose APIs, not raw driver writes or a server-side immutable collection policy. Requests, intents and sequences are mutable and do not use appendOnly.','backend/models/BookstoreControl.js','function appendOnly'),
('Bookstore audit','Pre-validate operationalProjection sanitizes before/after. minimize:false preserves empty objects. targetKind is an enum discriminator but has no target existence validator.','backend/models/BookstoreControl.js','audit.pre("validate"'),
('Stock movement','Safe integer delta/before/after; before/after >=0. Pre-validate requires before+delta=after, delta!=0, size row equations/nonzero deltas, and sum(size deltas)=aggregate delta when sizeChanges is present.','backend/models/BookstoreControl.js','movement.pre'),
('Operational payment/reversal/sequence','Payment and reversal amount >=0 and safe integer; cash/gcash enum. Each transactionId unique. Sequence seq >=1 and safe integer; (storeId,year) unique. year is required Number with no integer/range validator.','backend/models/BookstoreControl.js','const payment ='),
('Default strict mode','Most legacy schemas use Mongoose strict:true; control schemas and Store use strict:throw. Mixed payloads retain arbitrary internal keys unless their custom validator/writer constrains them. select:false is a query projection default, not encryption/access control.','backend/models/Store.js','strict: "throw"'),
]
lines.append(table(['Scope','Actual rule/limit','Evidence'],[(a,b,evidence(c,d)) for a,b,c,d in constraints]))
lines += ['### 7.2 Backend service and controller constraints\n']
services=[
('Store membership and identity','Membership command validates canonical IDs, no duplicates, expected epoch, existing Store records, and changed membership; mutations revoke affected grants. Store creation makes a placeholder Customer and sets orderCustomer in the transaction; it does not silently assign memberships.','backend/services/accountManagement.js','export async function replaceStoreMemberships'),
('Scope and referential checks','bookstoreCommand checks active/confirmed/current actor, explicit store membership, Store existence and capability/resource scope. Reads use bookstoreReadScope and mappedStoreFilter. These are request/service checks, not schema foreign keys.','backend/services/bookstoreCommand.js','export async function bookstoreCommand'),
('Pricing/cart','Requires nonempty dense cart, canonical product IDs, positive safe-integer quantities, existing active products in the same store, PHP-centavos marker, safe price/subtotal/total, selected clothing size/stock. Uses current stored prices, not client unit prices.','backend/services/bookstoreOrders.js','export async function pricedItems'),
('Stock concurrency','Compare-and-update includes prior stock/sizeStocks with store identity; rejects invalid/noninteger/negative results and stale writes; records one movement per product/actor/operation. Same-total size redistribution is retained in audit but no aggregate StockMovement is created when delta=0.','backend/services/sizeInventory.js','export async function changeProductStock'),
('Sale completion','Requires pending/unrecorded assigned order, unarchived queue entry, confirmed full cash/GCash payment, GCash reference, matching quote digest/confirmed total; checks all in transaction; writes stock, order, invoice, payment, audit, operation receipt. No external payment verification service is called.','backend/services/bookstoreOrders.js','export async function completeOrder'),
('Reversal','Requires fully paid completed unreversed sale, request in requested state, invoice linkage and authority; returned lines must match sold product/size and have positive safe-integer quantities <=sold quantities with no duplicates. Full repayment must use original method; GCash reference required. Only selected returned quantities restore stock.','backend/services/bookstoreOrders.js','async function reversalAssessment'),
('Idempotency','Account command: globally unique operationId receipt plus actor/target/fingerprint match. Bookstore command: unique (actorKey,operationId), matching private fingerprint required on replay; unique audit event positions and movement keys constrain duplicate effects. Conflict returns 409; commit uncertainty must not be treated as definite failure/replayed blindly.','backend/services/accountManagement.js','export async function accountCommand'),
('Transactions','accountTransaction uses snapshot read concern, majority write concern, primary preference, observed commit handling, and shared realm write-fence; deployed transaction/topology support not verified.','backend/utils/accountTransaction.js','session.withTransaction'),
('Guest order identity','Public Store and creator checked, intent verifier loaded with select override and validated, receipt replay checked, existing Order with intent ID prevents second submission; transaction._id = intent._id. Credential expires after seven days in code, not TTL.','backend/services/guestOrders.js','export async function submitGuestOrder'),
('Order reference collision','Sparse unique bookstoreReference index plus preflight lookup and bounded whole-command retry only for known duplicate-reference errors, excluding uncertain commits.','backend/utils/orderReference.js','export async function withOrderReferenceRetry'),
('Invoice numbering','Bookstore store/year sequence pair is unique; service skips already-used invoice numbers for that store. Legacy owner/type/year counter is not unique. Invoice invoiceNumber and transaction pairs have ordinary indexes only.','backend/services/bookstoreOrders.js','async function receiptNumber'),
('Independent role/grant controls','Prevents self-review/self-grant, stale approvals, loss of last active Administrator; review evidence 1–20 bounded strings; grants 1–13 distinct capabilities, exact bounded scope of 1–100 unique IDs, explicit dates/approvalRef, effectiveAt<expiresAt, future expiry and version bindings. These exceed schema validation.','backend/services/accountManagement.js','export async function grantPermission'),
('Historical mapping','Internal preparation/apply functions require explicit bounded mapping manifest, digest snapshot, valid owner, existing related records in target/mapping scope, duplicate SKU/invoice checks, reviewed reference/count, and atomic store attribution; no automatic money conversion. Not invoked during audit.','backend/services/bookstoreMapping.js','async function inspect'),
('Product deletion/categories','Deletion blocked by order/invoice/movement/return/receipt history or remaining stock and unverified monetary units. Category service enforces names, case-insensitive create/rename duplicates, assigned-product replacement and size transition checks. These are application rules, not unique/category indexes.','backend/services/productManagement.js','export async function productDeletionStatus'),
('Customer/debt/legacy payment','Customer deletion blocked by outstanding debt then soft-deletes. Debt payment controller checks same owner/customer, balance, nondeleted customer, positive rounded amount and reference for GCash/bank. Customer-wide settlements update multiple transactions but store no per-transaction allocation array. Current route perimeter blocks legacy operational writes.','backend/controllers/DebtPaymentController.js','export async function createDebtPayment'),
('Expense amount','Create controller requires positive amount, but update controller/schema do not repeat the positivity check. Current legacy perimeter restricts effectful access. No expense amount min schema rule.','backend/controllers/ExpenseController.js','export const updateExpense'),
('Legacy route boundary','Legacy user is read-only; admin writes outside /api/products rejected in requireLegacyOperationalAccess. Old order/debt/expense writer implementations still exist, but existence in a controller is not proof the routed write is currently reachable.','backend/middleware/roleAdmission.js','export function requireLegacyOperationalAccess'),
]
lines.append(table(['Scope','Implemented rule','Evidence'],[(a,b,evidence(c,d)) for a,b,c,d in services]))
lines += ['### 7.3 Constraints not present or not verified\n',
'No MongoDB server JSON-schema validator, automatic foreign-key checking, cascading delete, schema-level cross-store equality, unique product SKU/name, unique invoice number/transaction, unique legacy invoice-counter partition, unique reversal request per transaction, or TTL index is declared. No schema nonempty-array validator is declared for transaction items, returned rows, evidenceRefs, categoryNames, or sizeChanges. Optional `storeId`/`moneyUnit` allow historical absence. No unique Store.orderCustomer or SaleReversal.requestId index is declared. No application-wide uniqueness of payment/refund reference is enforced by inspected code. Append-only middleware and service constraints do not protect against bypass through raw database writes. The database was not queried to verify server validators/indexes.\n',
'## 8. Complete Data Dictionary\n',
'Every persisted schema path appears below; section 4 supplies enums, references, indexes and detailed validation. Defaults distinguish explicit defaults, Mongoose automatic behavior, and middleware-generated timestamps. Conditional required functions are included verbatim. Nested array children apply per existing row.\n']
for m in MODELS:
    lines += [f'### {m["collection"]}\n',table(['Collection','Field Name','Data Type','Required','Default','Description'],[(m['collection'],f['path'],f['type'],required(f),default(f),describe(m,f)) for f in m['fields']])]

dynamic=[
('accountauditevents','actor','Object (plain nested container)','Container has no own required rule','None','Contains schema-defined actor.id, actor.role, actor.kind. Child fields listed above.'),
('users','storeIds[]','ObjectId inside Mixed','Not a separate schema path','None','Each membership value; validated as unique BSON ObjectId; Store existence checked in membership command.'),
('products','sizeStocks.<size>','Number inside Mixed','Not a separate schema path','None','Supported keys XS,S,M,L,XL,2XL,3XL,4XL; each provided value is a nonnegative safe integer. Not all keys required.'),
('invoices','snapshot.orderId / snapshot.cashierId','String inside Mixed','Not schema-declared','None','Identifiers copied by sale completion.'),
('invoices','snapshot.reference / snapshot.orderStatus / snapshot.moneyUnit / snapshot.invoiceNumber','String inside Mixed','Not schema-declared','None','Public order reference, lifecycle, monetary marker and issued receipt number captured by writer.'),
('invoices','snapshot.total','Number inside Mixed','Not schema-declared','None','Sale total in PHP centavos at issuance.'),
('invoices','snapshot.items[]','Array<Object> inside Mixed','Not schema-declared','None','Receipt item snapshots, no registered line-item model.'),
('invoices','snapshot.items[].productId / name / sku','String inside Mixed','Not schema-declared','None','Product ID and text snapshots; an unknown/missing name/SKU is represented by empty string by itemDto.'),
('invoices','snapshot.items[].size','String inside Mixed','Not schema-declared','None','Present only for sized sale lines.'),
('invoices','snapshot.items[].quantity / unitPrice / subtotal','Number inside Mixed','Not schema-declared','None','Quantity and monetary values copied from sale lines.'),
('invoices','snapshot.assignedTo','String or null inside Mixed','Not schema-declared','None','Assigned cashier identifier copied by orderDto.'),
('invoices','snapshot.issuedAt','String (ISO date) inside Mixed','Not schema-declared','None','Completion timestamp converted with toISOString.'),
('invoices','snapshot.paymentMethod / snapshot.paymentReference','String inside Mixed','Not schema-declared','None','Original payment method/reference snapshot.'),
('bookstoresalereversals','returned[].productId','String inside Mixed row','Service requires, not child schema','None','Sold Product ID validated by reversal assessment.'),
('bookstoresalereversals','returned[].quantity','Number inside Mixed row','Service requires, not child schema','None','Positive safe-integer units restored, <= sold units for product/size.'),
('bookstoresalereversals','returned[].size','String inside Mixed row','Optional','None','Copied size when supplied; must match exact sold line.'),
('guestorderintents','verification.digest','String inside Mixed','Verifier function expects, not child schema','None','SHA-256 verifier format; no actual digest/credential values included.'),
('guestorderintents','verification.issuedAt / verification.expiresAt','Date inside Mixed','Verifier function expects, not child schema','None','Issue and expiry dates with exact seven-day span checked by verifier.'),
('conditionalaccountgrants','scope.kind','String inside Mixed','Grant service requires, not child schema','None','Capability scope kind matching policy.'),
('conditionalaccountgrants','scope.resourceIds[]','String inside Mixed array','Grant service requires 1–100, not child schema','None','Canonical target ID strings; no duplicate resource IDs; bounded to recipient authority.'),
('accountauditevents','scope.kind / scope.accountId','String or ObjectId-compatible identifier in Mixed','Constructed by ordinary account command','None','Ordinary account-realm scope; grant-related audit entries can instead use capability scope.'),
('accountauditevents, bookstoreauditevents','before.*, after.*','Mixed open object paths','No fixed child schema','None','Command-dependent state copies. Examples include role/confirmed/accountState/version, stock/lifecycle, returned and queue visibility. No universally exhaustive child-field inventory exists.'),
('accountoperationreceipts, bookstoreoperationreceipts','result.*','Mixed open response DTO paths','No fixed child schema','None','Command-dependent result including operationId and optional IDs/account/order/receipt/payment fields. Defined response shapes vary; schema permits arbitrary content.'),
]
lines += ['### Embedded containers and usage-defined Mixed subpaths\n','These rows are **not additional declared schema paths**. They document current constructors/validators described in section 6. `*` denotes open content, not a Mongoose wildcard field. This distinction avoids inventing a closed schema for Mixed payloads.\n',table(['Collection','Field Name','Data Type','Required','Default','Description'],dynamic),
'## 9. Entity Relationship Diagram\n',
'Mermaid source: [database-erd.mmd](database-erd.mmd). All 23 code-defined collection mappings are included, with financials labeled as not loaded. Mermaid ER entity attributes do not support full nested boxes; embedded paths are explicitly labeled within their parent collection and never drawn as independent entities. The diagram is an overview of important links; section 5 is the fuller relationship ledger.\n',
'Solid cardinality ends describe application-intended logical associations; dotted relationship lines indicate non-identifying references with no foreign-key enforcement. Identifier-field presence is not proof that a referenced document exists. `0..1` payment/reversal per transaction depends on declared unique transactionId indexes being deployed. Invoice count remains 0..many at schema level despite the intended one-invoice workflow.\n',
'No `mmdc` executable or Mermaid renderer package was found in the existing project environment. No new dependencies were installed and no remote renderer received this schema. No standalone rendered image was generated; the Mermaid source can be rendered by an existing compatible documentation viewer.\n',
'## 10. Schema and Application Usage Findings\n']
findings=[
('F01','Financial model is definition-only in the application import graph','Offline app import registers 22 models; explicit import of all model modules adds only Financial. FinancialController aggregates Transaction/Customer and never imports Financial. Therefore financials must not be asserted as a verified active/live collection.', 'backend/controllers/FinancialController.js','import Transaction'),
('F02','No unique invoice or legacy counter partition index','Invoice indexes owner+invoiceNumber and owner+transaction, and InvoiceCounter owner+type+year, are nonunique. Service checks/intended sequence generation are not equivalent to uniqueness enforced on these fields.', 'backend/models/Invoice.js','invoiceSchema.index'),
('F03','No unique catalog SKU/name declaration','Product owner+sku/name indexes are nonunique. Historical mapping detects collisions, while ordinary catalog creation does not check SKU uniqueness; duplicate SKU/name is not generally prohibited.', 'backend/services/catalogService.js','export async function createBookstoreProduct'),
('F04','User.email requested but absent from schema','OrderController populates processedBy selecting name email identifier. User defines no email. Customer.email exists, but it is a different collection/identity.', 'backend/controllers/OrderController.js','name email identifier'),
('F05','Legacy raw query targets a virtual/nonpersisted product path','productDeletionStatus checks products.product in addition to items.product. Transaction.products is a getter virtual and not a declared persisted path; the query looks like a historical compatibility probe, not a second embedded array declaration.', 'backend/services/productManagement.js','"products.product"'),
('F06','Aggregation fields are not missing persisted Customer fields','PersonController computes summary, totalDebt, totalPaid, totalOrders, totalSpent, lastTransaction and balance in an aggregation. Customer defines summary-reading virtuals but no stored summary/debt collections. Do not add these output-only fields to the persisted schema.', 'backend/controllers/PersonController.js','summaryRows'),
('F07','Declared fields with no dedicated operational writer','Financial.capitalInvested/grossIncome/netIncome and embedded expenses have no runtime model consumer; Product.costPrice appears only as a schema field/projection exclusion; Transaction.voidReason has no non-model application usage, and voidedAt is read but no current writer was found. Keep these declared paths in documentation while labeling activity unverified.', 'backend/models/Order.js','voidReason'),
('F08','Relationships rely heavily on application references','User.storeIds and legacy-resource storeId are Mixed. Most operational ObjectId IDs have no Mongoose ref. Scope.resourceIds, receipt snapshot IDs and returned product IDs are strings inside Mixed. Validation/existence checks live in services, not database foreign keys.', 'backend/models/resourceAttribution.js','Mixed deliberately'),
('F09','Reversal target discriminator is overloaded','BookstoreAuditEvent.targetKind Reversal names either a request or an applied reversal, resolved by action. It is not a registered model named Reversal.', 'backend/services/bookstoreOrders.js','"reversal.requested"'),
('F10','Multiple reversal requests permitted','Request creation checks sale eligibility but has no duplicate outstanding-request lookup or unique transactionId. SaleReversal.transactionId is unique and request status/application checks prevent ordinary repeated application; pending requests may remain after another request is applied.', 'backend/services/bookstoreOrders.js','export async function requestReversal'),
('F11','Legacy and bookstore monetary contracts coexist','Legacy-compatible schemas allow missing storeId/moneyUnit and broader bank/credit payment methods. Bookstore services require PHP-centavos and safe integer money with cash/gcash only. Never infer a historical unit from numeric values.', 'backend/models/resourceAttribution.js','Explicit marker'),
('F12','Debt settlements may lack allocation history','DebtPayment.transaction is optional; customer-wide settlement updates multiple transaction balances but creates one payment without per-transaction allocations. A direct payment-to-each-transaction relationship cannot be reconstructed solely from that payment document.', 'backend/controllers/DebtPaymentController.js','const unpaidTransactions'),
('F13','Schema hooks do not universally ensure totals/immutability','Transaction supplied subtotal is trusted by its hook; services price current items. Append-only middleware is client-side protection, and raw driver access can bypass it. The schema is not a server validator.', 'backend/models/Order.js','item.subtotal = Number'),
('F14','Account deletion can leave historical identifiers','deleteAccount deletes User after revoking grants and writing audit, without cascading removal or a universal reference-blocking scan. Audit/ownership/creator IDs can therefore intentionally outlive the account.', 'backend/services/accountManagement.js','export async function deleteAccount'),
('F15','Queue removal is an audit event, not a Transaction field','order.queue_removed controls queue visibility; there is no stored queueRemoved/archived field on Transaction. Service returns queueRemoved as a response flag and leaves order state/record unchanged.', 'backend/services/cashierQueue.js','const prior ='),
('F16','Stale comments conflict with live route bindings','Comments in guestOrderAccess, accountManagement membership foundation and resourceScope describe unbound functionality, but BookstoreRoute binds guest ordering and membership endpoints and uses scoped services. Route imports/bindings take precedence over comments for this audit.', 'backend/routes/BookstoreRoute.js','router.post("/accounts/:id/memberships"'),
('F17','Reversed is a read DTO state, not persisted orderStatus enum','trackGuestOrder returns reversed when reversalId exists; applyReversal sets reversalId/reversedAt without changing orderStatus to a nonexistent reversed enum. Existing orderStatus remains completed.', 'backend/services/guestOrders.js','order.reversalId ? "reversed"'),
]
lines.append(table(['ID','Finding','Source-supported detail','Evidence'],[(a,b,c,evidence(d,e)) for a,b,c,d,e in findings]))
lines += ['### Model consumer inventory\n','The following references exclude model definitions, test fixtures and dependencies. A file listed here imports the model module; it does not prove live database rows exist or that every exported function is reachable.\n']
consumers=[]
for m in MODELS:
    module=model_file(m['model']).split('/')[-1]
    files=[]
    for entry in D['sourceManifest']:
        if entry['path'].startswith('backend/models/') or not entry['path'].endswith('.js'): continue
        text=(ROOT/entry['path']).read_text(encoding='utf-8-sig')
        if re.search(r'import[\s\S]*?from\s+[\"\x27]\.\./models/' + re.escape(module)+r'[\"\x27]', text):
            if module in ['AccountControl.js','BookstoreControl.js']:
                aliases={'AccountAuditEvent':'AccountAudit','ConditionalAccountGrant':'AccountGrant','AccountRoleReview':'AccountReview','AccountOperationReceipt':'AccountReceipt','AccountAdministrationRealm':'AccountRealm','BookstoreAuditEvent':'BookstoreAudit','BookstoreOperationReceipt':'BookstoreReceipt','BookstorePayment':'BookstorePayment','BookstoreReversalRequest':'ReversalRequest','BookstoreSaleReversal':'SaleReversal','StockMovement':'StockMovement','GuestOrderIntent':'GuestOrderIntent','BookstoreSequence':'BookstoreSequence'}
                if not re.search(r'\b'+aliases[m['model']]+r'\b',text): continue
            files.append(evidence(entry['path'],module))
    consumers.append([m['model'],'; '.join(files) if files else 'None found outside definition/tests'])
lines.append(table(['Model','Application consumers'],consumers))
application_text = '\n'.join((ROOT / x['path']).read_text(encoding='utf-8-sig') for x in D['sourceManifest'] if x['path'].endswith('.js') and not x['path'].startswith('backend/models/'))
unreferenced = [(m['model'], f['path'], evmodel(m['model'])) for m in MODELS for f in m['fields'] if not re.search(r'\b' + re.escape(f['path'].split('.')[-1]) + r'\b', application_text)]
lines += ['### Declared field names absent from non-model application source\n',
          'A conservative identifier scan of all non-test backend JavaScript outside models found the following field names with no occurrence. This does not prove historical data is unused; shared/common names and generic serializers prevent a complete semantic dead-field proof. Dedicated writers absent for additional fields are identified in F07.\n',
          table(['Model','Field','Definition evidence'], unreferenced)]
lines += ['## 11. Limitations and Items Requiring Verification\n',
'1. Physical MongoDB collection existence, extra legacy collections, document counts/actual shapes, deployed indexes (including unique/sparse), server JSON validators, server version, sharding/topology and database name were not inspected. A code model mapping is not proof of a populated/active collection.\n',
'2. Current on-disk source contains pre-existing uncommitted application changes. This audit describes that source snapshot, not necessarily production or a particular released commit. The metadata sourceManifest records SHA-256 hashes of non-test backend JS/package JSON files for reproducibility, without environment values.\n',
'3. Mixed fields intentionally admit open schemas or preserve malformed historical values. Their current service-created shapes are documented separately from declared paths. Existing documents may differ, and optional newly introduced fields may be missing in historical records.\n',
'4. No migration directory or runnable general migration framework was found. `backend/utils/seedAdmin.js` exists but disables offline administrator bootstrap and requires a separately authorized recovery procedure; it was not executed. `bookstoreMapping.js` provides internal reviewed historical-attribution preparation/application functions, not a startup migration. Test fixtures/seeded test data are not production schema or evidence of collection existence. '+evidence('backend/utils/seedAdmin.js','Offline Administrator bootstrap')+'\n',
'5. Runtime behavior/concurrency was reasoned from source, not exercised against any database. Application tests were not run because this is a schema-only documentation task and some suites create/drop test databases. No live/model index synchronization was performed.\n',
'6. No application source, project configuration, package lock, model or database record was changed. Deliverables are this audit, Mermaid source, Chapter 26.2 summary, offline extractor, documentation builder and metadata. No standalone diagram image is claimed.\n',
'7. Reproduction: from the project root, run `node docs/database-schema/extract-schema.mjs`, then execute `docs/database-schema/build-audit.py` with an available Python interpreter. This inspection used the already installed Blender-bundled interpreter at `C:/Program Files/Blender Foundation/Blender 5.0/5.0/python/bin/python.exe`; the ordinary python/py launchers have no usable installation. The extractor imports app.js/models only, blocks connection entry points and disables autoCreate/autoIndex; do not replace it with index.js or invoke service/seed functions. Metadata contains code/default/validator descriptions only, never records or environment values.\n']
(OUT/'database-schema-audit.md').write_text('\n'.join(lines),encoding='utf-8')

chapter='''# Chapter 26.2 – Database Documentation

## 26.2.1 Entity Relationship Diagram

The implementation uses MongoDB documents accessed through Mongoose. Source inspection found 23 declared model-to-collection mappings; 22 models are loaded by the application, while Financial is defined but apparently unused. The diagram in [database-erd.mmd](database-erd.mmd) includes all code-defined collections and labels embedded records within their parents. Collection existence and deployed indexes were not checked against a live database.

## 26.2.2 Collection Structures

Core collections are users, stores, customers, products, transactions, invoices, invoicecounters, debtpayments and expenses. financials is definition-only. Operational support consists of accountadministrationrealms, accountauditevents, accountoperationreceipts, accountrolereviews, conditionalaccountgrants, bookstoreauditevents, bookstoreoperationreceipts, bookstorepayments, bookstorereversalrequests, bookstoresalereversals, bookstoresequences, guestorderintents and stockmovements. Transaction items and clothing stock changes are embedded arrays, not separate collections. Mixed payloads hold receipt snapshots, command results, guest verifiers and scoped authority data.

## 26.2.3 Database Relationships

Users hold multiple store memberships; stores may have multiple member users. Products, customer contacts, transactions and operational ledgers carry store attribution. Transactions reference customer contacts and embed lines referencing products, yielding a transaction-to-product many-to-many association. Account references record submission, assignment and sale processing separately. Invoices reference transactions; their schema permits multiple invoices per transaction although services intend one. Payment and applied-reversal records each declare a unique transactionId, permitting at most one of each per sale if those indexes are deployed. Reversal requests are separate and may be multiple per sale. A guest intent shares its identifier with its submitted guest transaction. MongoDB does not enforce relational foreign keys for these links.

## 26.2.4 Database Constraints

Mongoose declares required fields, enums, numeric bounds, defaults, custom validators and indexes. Services add store/owner checks, current-price calculation, stock concurrency checks, payment/reversal eligibility, grant expiry/version rules and idempotency. Unique declarations include account identifier, sparse account phone, sparse bookstore order reference, audit/operation identities, stock movement operation identities, payment/reversal transaction IDs and the bookstore sequence store/year pair. Invoice number, invoice transaction, product SKU and the legacy invoice counter partition are not unique schema indexes. Append-only ledger middleware is an application safeguard, not database-level immutability. Historical records can lack storeId and moneyUnit; amounts must not be assumed to use PHP centavos without the explicit marker.

## 26.2.5 Data Dictionary

The complete [database schema audit](database-schema-audit.md) lists every declared path, automatic identifier/version/timestamp field, embedded child path, data type, required rule and default. Its structure tables additionally retain enums, references, setters, validators and exact index declarations. Usage-defined Mixed subpaths and nonpersisted virtual/output fields are identified separately. This dictionary documents the inspected implementation and does not propose a replacement schema.
'''
(OUT/'chapter-26.2-database-documentation.md').write_text(chapter,encoding='utf-8')
print(f'Wrote audit and Chapter 26.2 summary: {sum(len(m["fields"]) for m in MODELS)} schema paths, {len(relationships)} relationship rows.')
