<div align="center">

# 🗄️ schema.js

**A fluent, chainable MySQL schema builder for Node.js**

[![npm version](https://img.shields.io/npm/v/schema-builder-mysql?color=2563A8&style=flat-square)](https://www.npmjs.com/package/schema-builder-mysql)
[![license](https://img.shields.io/npm/l/schema-builder-mysql?color=1A5C3A&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/schema-builder-mysql?color=7A4A00&style=flat-square)](https://nodejs.org)
[![mysql](https://img.shields.io/badge/MySQL-8.0%2B-blue?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)

Create, alter, and introspect MySQL tables using a clean JavaScript API — no raw SQL required.

</div>

---

## ✨ Features

- 🔗 **Fully chainable** — `t.string('email').unique().notNullable().default('anon@')`
- 🧱 **40+ column types** — all MySQL types including spatial, blob, enum, json, generated
- 🔄 **Full ALTER TABLE support** — add, modify, rename, drop columns; manage indexes and foreign keys
- 🔍 **Schema introspection** — `hasTable`, `hasColumn`, `getColumns`
- ⚡ **Batched operations** — multiple ALTER actions compile to a single SQL statement
- 🛡️ **Safe defaults** — `CREATE TABLE IF NOT EXISTS`, `DROP TABLE IF EXISTS`

---

## 📦 Installation

```bash
npm install schema-builder-mysql
```

```bash
yarn add schema-builder-mysql
```

---

## 🚀 Quick Start

```js
const { Schema } = require('schema-builder-mysql');

// Create a table
await Schema.create('users', (t) => {
    t.increments('id');
    t.string('name', 100).notNullable();
    t.string('email', 150).unique().notNullable();
    t.boolean('active').default(1);
    t.timestamps();
});

// Add a column later
await Schema.table('users', (t) => {
    t.string('phone', 20).nullable().after('email');
    t.boolean('verified').default(0);
});

// Introspect
const exists = await Schema.hasTable('users');        // → true
const cols   = await Schema.getColumns('users');      // → ['id', 'name', ...]
```

---

## 📖 Table of Contents

- [Schema API](#-schema-api)
- [Column Types](#-column-types)
- [Column Modifiers](#-column-modifiers)
- [Table Constraints & Options](#-table-constraints--options)
- [AlterBuilder Operations](#-alterbuilder-operations)
- [Full Examples](#-full-examples)
- [Return Value](#-return-value)

---

## 🗂 Schema API

All methods are `static` and `async`. Import only `Schema`.

```js
const { Schema } = require('schema-builder-mysql');
```

### `Schema.create(name, callback)` → `Promise<Result>`

Creates a new table. The callback receives a `TableBuilder`.

```js
await Schema.create('posts', (t) => {
    t.increments('id');
    t.string('title', 200).notNullable();
    t.longText('body').nullable();
    t.enum('status', 'draft', 'published', 'archived').default('draft');
    t.integer('user_id').unsigned()
        .references('users', 'id', 'CASCADE', 'CASCADE');
    t.timestamps();
    t.addIndex(['status', 'created_at']);
    t.fullText(['title', 'body']);
    t.engine('InnoDB');
    t.comment('Blog posts');
});
```

---

### `Schema.table(name, callback)` → `Promise<Result>`

Alters an existing table. The callback receives an `AlterBuilder`. All operations in one call are compiled into **a single `ALTER TABLE` statement**.

```js
await Schema.table('users', (t) => {
    t.string('avatar_url', 500).nullable().after('email');
    t.dropColumn('legacy_token');
    t.renameColumn('bio', 'about');
    t.modify('name').string(null, 200).notNullable();
    t.addIndex('email');
});
```

---

### `Schema.drop(name)` → `Promise<Result>`

Drops a table with `DROP TABLE IF EXISTS`. Safe if the table does not exist.

```js
await Schema.drop('old_table');
```

---

### `Schema.rename(from, to)` → `Promise<Result>`

```js
await Schema.rename('users_v1', 'users');
```

---

### `Schema.hasTable(name)` → `Promise<boolean>`

```js
if (await Schema.hasTable('users')) {
    console.log('table exists');
}
```

---

### `Schema.hasColumn(table, column)` → `Promise<boolean>`

```js
const ok = await Schema.hasColumn('users', 'email'); // true | false
```

---

### `Schema.getColumns(table)` → `Promise<string[]>`

Returns column names ordered by `ORDINAL_POSITION`.

```js
const cols = await Schema.getColumns('users');
// → ['id', 'name', 'email', 'created_at', 'updated_at']
```

---

## 📐 Column Types

All column methods are available inside both `Schema.create()` and `Schema.table()` callbacks. Each returns a `ColumnBuilder` for chaining.

### Auto-Increment

| Method | SQL |
|--------|-----|
| `t.increments(name?)` | `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` |
| `t.bigIncrements(name?)` | `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY` |

> ⚠️ MySQL only allows **one** `AUTO_INCREMENT` column per table. Never use both in the same table.

---

### Timestamps Shorthand

```js
t.timestamps();
// Adds:
//   created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
//   updated_at  TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
```

---

### Integer Types

| Method | SQL Type |
|--------|----------|
| `t.bit(name, length?)` | `BIT(n)` — default length 1 |
| `t.tinyInteger(name)` | `TINYINT` |
| `t.boolean(name)` | `BOOLEAN` |
| `t.smallInteger(name)` | `SMALLINT` |
| `t.mediumInteger(name)` | `MEDIUMINT` |
| `t.integer(name)` | `INT` |
| `t.int(name)` | `INT` (alias) |
| `t.bigInteger(name)` | `BIGINT` |

---

### Decimal / Float Types

| Method | SQL Type |
|--------|----------|
| `t.decimal(name, precision?, scale?)` | `DECIMAL(p,s)` — default `10,2` |
| `t.numeric(name, precision?, scale?)` | `NUMERIC(p,s)` — alias for decimal |
| `t.float(name, precision?)` | `FLOAT` or `FLOAT(n)` |
| `t.double(name, precision?, scale?)` | `DOUBLE` or `DOUBLE(p,s)` |
| `t.real(name)` | `REAL` |

---

### Date & Time Types

| Method | SQL Type |
|--------|----------|
| `t.date(name)` | `DATE` |
| `t.datetime(name, fsp?)` | `DATETIME` or `DATETIME(fsp)` |
| `t.timestamp(name, fsp?)` | `TIMESTAMP` or `TIMESTAMP(fsp)` |
| `t.time(name, fsp?)` | `TIME` or `TIME(fsp)` |
| `t.year(name)` | `YEAR` |

---

### String Types

| Method | SQL Type |
|--------|----------|
| `t.char(name, length?)` | `CHAR(n)` — default 1 |
| `t.string(name, length?)` | `VARCHAR(n)` — default 255 |
| `t.varchar(name, length?)` | `VARCHAR(n)` — alias for string |
| `t.tinyText(name)` | `TINYTEXT` |
| `t.text(name)` | `TEXT` |
| `t.mediumText(name)` | `MEDIUMTEXT` |
| `t.longText(name)` | `LONGTEXT` |

---

### Binary / Blob Types

| Method | SQL Type |
|--------|----------|
| `t.binary(name, length?)` | `BINARY(n)` |
| `t.varBinary(name, length?)` | `VARBINARY(n)` |
| `t.tinyBlob(name)` | `TINYBLOB` |
| `t.blob(name)` | `BLOB` |
| `t.mediumBlob(name)` | `MEDIUMBLOB` |
| `t.longBlob(name)` | `LONGBLOB` |

---

### Other Types

| Method | SQL Type |
|--------|----------|
| `t.enum(name, ...values)` | `ENUM('a','b',...)` — values are auto-escaped |
| `t.json(name)` | `JSON` |

```js
t.enum('status', 'active', 'inactive', 'banned').default('active');
t.json('metadata').nullable();
```

---

### Spatial Types

| Method | SQL Type |
|--------|----------|
| `t.geometry(name)` | `GEOMETRY` |
| `t.point(name)` | `POINT` |
| `t.lineString(name)` | `LINESTRING` |
| `t.polygon(name)` | `POLYGON` |
| `t.multiPoint(name)` | `MULTIPOINT` |
| `t.multiLineString(name)` | `MULTILINESTRING` |
| `t.multiPolygon(name)` | `MULTIPOLYGON` |
| `t.geometryCollection(name)` | `GEOMETRYCOLLECTION` |

---

## 🔧 Column Modifiers

All modifier methods return `this` — they are fully chainable.

| Modifier | Description |
|----------|-------------|
| `.nullable()` | Allow `NULL` values |
| `.notNullable()` | Forbid `NULL` (default behaviour) |
| `.default(value)` | Set `DEFAULT`. Strings are quoted automatically. `CURRENT_TIMESTAMP`, `NOW()`, `UUID()` are emitted raw. |
| `.unique()` | Add `UNIQUE` index |
| `.primary()` | Set as `PRIMARY KEY` |
| `.unsigned()` | Add `UNSIGNED` |
| `.zerofill()` | Add `ZEROFILL UNSIGNED` |
| `.check(expr)` | Add `CHECK (expr)` |
| `.autoIncrement()` | Add `AUTO_INCREMENT PRIMARY KEY` |
| `.charset(value)` | Set `CHARACTER SET` |
| `.collate(value)` | Set `COLLATE` |
| `.comment(text)` | Add column `COMMENT` |
| `.invisible()` | Mark `INVISIBLE` (MySQL 8.0.23+) |
| `.after(col)` | Position `AFTER col` — ALTER TABLE only |
| `.references(table, col?, onDelete?, onUpdate?)` | Add `FOREIGN KEY` constraint |
| `.generatedAs(expr, stored?)` | Define as computed column (`VIRTUAL` or `STORED`) |

### `.default(value)` — Smart SQL detection

```js
t.string('role').default('user');               // DEFAULT 'user'
t.integer('count').default(0);                  // DEFAULT 0
t.timestamp('ts').default('CURRENT_TIMESTAMP'); // DEFAULT CURRENT_TIMESTAMP  ← raw, no quotes
```

### `.references()` — Foreign Keys

```js
t.integer('user_id').unsigned()
    .references('users', 'id', 'CASCADE', 'CASCADE');
// CONSTRAINT `fk_posts_user_id` FOREIGN KEY (`user_id`)
// REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `foreignTable` | string | — | Referenced table |
| `foreignCol` | string | `'id'` | Referenced column |
| `onDelete` | string | `'RESTRICT'` | `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION` |
| `onUpdate` | string | `'RESTRICT'` | `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION` |

### `.generatedAs()` — Computed Columns

```js
// VIRTUAL — computed on read, not stored on disk
t.string('full_name', 220)
    .generatedAs("CONCAT(`first_name`, ' ', `last_name`)", false)
    .nullable();

// STORED — computed once and persisted on disk
t.decimal('total', 10, 2)
    .generatedAs('`qty` * `unit_price`', true);
```

---

## 🏗 Table Constraints & Options

These methods are called at the **table level** inside `Schema.create()`, not chained on a column.

### Primary & Unique Keys

```js
// Composite PRIMARY KEY
t.primaryComposite('order_id', 'product_id');
// PRIMARY KEY (`order_id`, `product_id`)

// Composite UNIQUE KEY — auto-named uq_{table}_{cols}
t.uniqueComposite('slug', 'tenant_id');
// UNIQUE KEY `uq_posts_slug_tenant_id` (`slug`, `tenant_id`)
```

### Indexes

```js
t.addIndex(['status', 'created_at']);
// INDEX `idx_posts_status_created_at` (`status`, `created_at`)

t.fullText(['title', 'body']);
// FULLTEXT INDEX `ft_posts_title_body` (`title`, `body`)

t.spatialIndex('location');
// SPATIAL INDEX `sp_places_location` (`location`)
```

### Table Options

```js
t.engine('InnoDB');
t.charset('utf8mb4');
t.collate('utf8mb4_unicode_ci');
t.comment('Stores user accounts');
```

---

## 🔄 AlterBuilder Operations

Use `Schema.table()` to run any of these. All operations in one callback are **batched into a single `ALTER TABLE`**.

### Add Columns

```js
await Schema.table('users', (t) => {
    t.string('phone', 20).nullable().after('email');
    t.boolean('verified').default(0);
    t.decimal('balance', 10, 2).default(0.00);
    t.enum('tier', 'free', 'pro', 'enterprise').default('free');
    t.timestamps(); // ADD created_at + updated_at
});
```

### Modify a Column — `t.modify(col)`

Redefines a column completely with `MODIFY COLUMN`. You must re-specify all desired modifiers.

```js
await Schema.table('users', (t) => {
    t.modify('name').string(null, 200).notNullable();     // widen to VARCHAR(200)
    t.modify('score').integer().unsigned().default(0);   // change definition
});
```

> **Note:** The first argument to the type method inside `modify()` is ignored — the column name comes from `modify('colName')`.

### Drop & Rename Columns

```js
await Schema.table('users', (t) => {
    t.dropColumn('legacy_field');
    t.renameColumn('bio', 'about');  // MySQL 8.0+
});
```

### Manage Indexes

| Method | SQL |
|--------|-----|
| `t.addIndex(cols, name?)` | `ADD INDEX` — auto-name: `idx_{table}_{cols}` |
| `t.addUniqueIndex(cols, name?)` | `ADD UNIQUE KEY` — auto-name: `uq_{table}_{cols}` |
| `t.addFullText(cols, name?)` | `ADD FULLTEXT INDEX` — auto-name: `ft_{table}_{cols}` |
| `t.dropIndex(indexName)` | `DROP INDEX` by exact name |
| `t.dropPrimary()` | `DROP PRIMARY KEY` |

```js
await Schema.table('users', (t) => {
    t.addIndex('email');
    t.addUniqueIndex(['slug', 'tenant_id']);
    t.addFullText(['name', 'about']);
    t.dropIndex('idx_users_old_col');
});
```

### Manage Foreign Keys

```js
// Add FK
await Schema.table('orders', (t) => {
    t.integer('coupon_id').unsigned().nullable();
});
await Schema.table('orders', (t) => {
    t.addForeign('coupon_id', 'coupons', 'id', 'SET NULL', 'CASCADE');
    // ADD CONSTRAINT `fk_orders_coupon_id` FOREIGN KEY ...
});

// Drop FK (by constraint name, not column name)
await Schema.table('orders', (t) => {
    t.dropForeign('fk_orders_coupon_id');
});
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `column` | string | — | Column in this table |
| `foreignTable` | string | — | Referenced table |
| `foreignCol` | string | `'id'` | Referenced column |
| `onDelete` | string | `'RESTRICT'` | `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION` |
| `onUpdate` | string | `'RESTRICT'` | `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION` |

---

## 💡 Full Examples

<details>
<summary><strong>E-Commerce Schema — Users, Products, Orders</strong></summary>

```js
// Users
await Schema.create('users', (t) => {
    t.increments('id');
    t.string('name', 100).notNullable();
    t.string('email', 150).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.enum('role', 'customer', 'admin').default('customer');
    t.boolean('email_verified').default(0);
    t.timestamp('email_verified_at').nullable();
    t.timestamps();
    t.engine('InnoDB');
    t.comment('Platform users');
});

// Products
await Schema.create('products', (t) => {
    t.increments('id');
    t.string('sku', 50).unique().notNullable();
    t.string('name', 200).notNullable();
    t.longText('description').nullable();
    t.decimal('price', 10, 2).notNullable();
    t.integer('stock').unsigned().default(0);
    t.json('attributes').nullable();
    t.enum('status', 'active', 'draft', 'archived').default('draft');
    t.timestamps();
    t.fullText(['name', 'description']);
    t.addIndex('status');
});

// Orders
await Schema.create('orders', (t) => {
    t.increments('id');
    t.integer('user_id').unsigned()
        .references('users', 'id', 'RESTRICT', 'CASCADE');
    t.enum('status', 'pending', 'processing', 'shipped', 'delivered', 'cancelled')
        .default('pending');
    t.decimal('total', 12, 2).notNullable();
    t.json('shipping_address').nullable();
    t.timestamps();
    t.addIndex(['user_id', 'status']);
});
```

</details>

<details>
<summary><strong>Migrating an Existing Table</strong></summary>

```js
// Step 1 — Add new columns
await Schema.table('users', (t) => {
    t.string('avatar_url', 500).nullable().after('email');
    t.string('phone', 20).nullable().after('avatar_url');
    t.json('preferences').nullable();
});

// Step 2 — Modify + add index in one statement
await Schema.table('users', (t) => {
    t.modify('name').string(null, 200).notNullable();
    t.addIndex('phone');
});

// Step 3 — Add FK after adding the column
await Schema.table('orders', (t) => {
    t.integer('coupon_id').unsigned().nullable();
});
await Schema.table('orders', (t) => {
    t.addForeign('coupon_id', 'coupons', 'id', 'SET NULL', 'RESTRICT');
});

// Step 4 — Clean up
await Schema.table('users', (t) => {
    t.renameColumn('avatar_url', 'profile_photo');
    t.dropColumn('legacy_token');
});
```

</details>

<details>
<summary><strong>Generated (Computed) Columns</strong></summary>

```js
await Schema.create('employees', (t) => {
    t.increments('id');
    t.string('first_name', 80);
    t.string('last_name', 80);

    // VIRTUAL — computed on every read, not stored
    t.string('full_name', 165)
        .generatedAs("CONCAT(`first_name`, ' ', `last_name`)", false)
        .nullable();

    t.integer('hours_worked').unsigned().default(0);
    t.decimal('hourly_rate', 8, 2).default(0.00);

    // STORED — computed once and persisted
    t.decimal('gross_pay', 10, 2)
        .generatedAs('`hours_worked` * `hourly_rate`', true);

    t.timestamps();
});
```

</details>

<details>
<summary><strong>Composite Keys & Indexes</strong></summary>

```js
await Schema.create('order_items', (t) => {
    t.integer('order_id').unsigned();
    t.integer('product_id').unsigned();
    t.integer('qty').unsigned().default(1);
    t.decimal('unit_price', 10, 2);
    t.string('city', 100).nullable();
    t.string('country', 100).nullable();

    // Composite PRIMARY KEY — no separate id needed
    t.primaryComposite('order_id', 'product_id');

    // Composite UNIQUE
    t.uniqueComposite('city', 'country');

    // Regular + FK
    t.addIndex(['order_id']);
    t.integer('order_id').unsigned()
        .references('orders', 'id', 'CASCADE', 'CASCADE');
});
```

</details>

---

## 📤 Return Value

All `Schema` methods return a `Promise` that resolves to:

```js
{
    is_error: boolean,  // false = success, true = failure
    message:  string,   // human-readable result or error
    sql:      string,   // the generated SQL (create/alter only)
    data:     array     // query result rows (introspection methods)
}
```

```js
const result = await Schema.create('users', (t) => { /* ... */ });

if (result.is_error) {
    console.error(result.message); // "❗ Error creating table: ..."
} else {
    console.log(result.message);   // "✔ Table "users" created successfully."
    console.log(result.sql);       // full CREATE TABLE SQL
}
```

---

## 🔑 Quick Reference

```
Schema.create(name, cb)           CREATE TABLE IF NOT EXISTS
Schema.table(name, cb)            ALTER TABLE
Schema.drop(name)                 DROP TABLE IF EXISTS
Schema.rename(from, to)           RENAME TABLE
Schema.hasTable(name)             → boolean
Schema.hasColumn(table, col)      → boolean
Schema.getColumns(table)          → string[]

Column types (TableBuilder / AlterBuilder)
  t.increments / bigIncrements    INT/BIGINT AUTO_INCREMENT PK
  t.timestamps()                  created_at + updated_at
  t.integer / bigInteger / ...    numeric types
  t.string / text / longText / …  string types
  t.date / datetime / timestamp   date/time types
  t.enum(...values)               ENUM
  t.json()                        JSON
  t.binary / blob / ...           binary types

ColumnBuilder modifiers
  .nullable()  .notNullable()  .default(v)  .unique()
  .unsigned()  .zerofill()     .check(expr) .comment(text)
  .charset(v)  .collate(v)     .invisible() .after(col)
  .references(table, col, onDelete, onUpdate)
  .generatedAs(expr, stored)

AlterBuilder only
  t.modify(col).<type>()          MODIFY COLUMN
  t.dropColumn(name)              DROP COLUMN
  t.renameColumn(from, to)        RENAME COLUMN
  t.addIndex / addUniqueIndex     ADD INDEX / ADD UNIQUE KEY
  t.addFullText(cols)             ADD FULLTEXT INDEX
  t.dropIndex(name)               DROP INDEX
  t.dropPrimary()                 DROP PRIMARY KEY
  t.addForeign(col, table, ...)   ADD CONSTRAINT FOREIGN KEY
  t.dropForeign(constraintName)   DROP FOREIGN KEY
```

---

## 📄 License

MIT © 2024
