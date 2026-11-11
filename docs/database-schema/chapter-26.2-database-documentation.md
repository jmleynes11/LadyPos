# Chapter 26.2 – Database Documentation

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
