# Clothing sizes

Sizing applies only to the `Clothing` category (case-insensitive, trimmed).
Supported sizes are XS, S, M, L, XL, 2XL, 3XL and 4XL.

Managers select sizes and enter independent, nonnegative whole stock quantities
when creating or editing a clothing product. The product's stock total is the
sum of these quantities. Inventory adjustments require a size for clothing.
Existing inventory permissions and audit reasons remain in force.

Existing clothing products retain their stock totals. A manager must explicitly
allocate those units to sizes in Edit product before the product can be sold.
No existing stock is assigned to an assumed size automatically.

Cashier, student and guest clothing orders carry a selected size. Different sizes
of the same product remain distinct lines through quoting, payment, receipts and
saleable returns. Stock is deducted only on completed payment, using the existing
transaction boundary and operation replay protection. Size availability is
rechecked before completion. Returns identify the original purchased size.

Non-clothing products retain aggregate stock and unsized order payloads. Their
forms and cashier cards render no size controls. Changing a product or category
away from Clothing removes its size configuration and preserves aggregate stock.

Validation: 859 backend tests and 56 frontend tests passed; production build and
targeted frontend lint passed. Service tests use the repository's staged storage
adapter with real model validation, not a native MongoDB instance. Browser checks
used a disposable in-memory store with no database connection: clothing selection,
two-size checkout and receipt, per-size deduction, manager size editing, and
non-clothing controls. See `clothing-size-inventory.jpg` for the verified view.
