# Schema — MySQL Database Migration Builder

A fluent, chainable schema builder for MySQL. Provides `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, and introspection helpers — all returning promise-based results with `{ is_error, message, sql }`.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Schema Methods](#schema-methods)
  - [Create Table](#create-table)
  - [Alter Table](#alter-table)
  - [Drop Table](#drop-table)
  - [Rename Table](#rename-table)
  - [Introspection](#introspection)
- [Column Types Reference](#column-types-reference)
- [Column Modifiers](#column-modifiers)
- [Table-Level Constraints & Indexes](#table-level-constraints--indexes)
- [AlterBuilder Operations](#alterbuilder-operations)

---

## Quick Start

```js
const { Schema } = require('./framework/database/schema');

(async function () {
  const result = await Schema.create('users', (t) => {
    t.increments('id');
    t.string('name').notNullable();
    t.string('email', 100).unique();
    t.boolean('active').default(1);
    t.timestamps();
  });

  console.log(result.message);
  // ✔ Table "users" created successfully.
})();
```

---

## Schema Methods

### Create Table

```js
Schema.create(tableName, callback) → Promise<{ is_error, message, sql }>
```

Creates a table using `CREATE TABLE IF NOT EXISTS`. The `callback` receives a `TableBuilder` instance.

```js
await Schema.create('posts', (t) => {
  t.increments('id');
  t.string('title', 200).notNullable();
  t.longText('body').nullable();
  t.integer('user_id').unsigned().references('users', 'id', 'CASCADE', 'CASCADE');
  t.timestamps();
});
```

---

### Alter Table

```js
Schema.table(tableName, callback) → Promise<{ is_error, message, sql }>
```

Alters an existing table. The `callback` receives an `AlterBuilder` instance. Multiple operations can be chained in a single call.

```js
await Schema.table('users', (t) => {
  t.string('phone', 20).nullable().after('email');
  t.boolean('verified').default(0);
  t.dropColumn('old_field');
  t.renameColumn('bio', 'about');
  t.modify('name').string(null, 200).notNullable();
  t.addIndex('phone');
  t.addForeign('role_id', 'roles', 'id', 'CASCADE', 'CASCADE');
});
```

---

### Drop Table

```js
Schema.drop(tableName) → Promise<{ is_error, message }>
```

Drops a table using `DROP TABLE IF EXISTS`.

```js
await Schema.drop('sessions');
```

---

### Rename Table

```js
Schema.rename(from, to) → Promise<{ is_error, message }>
```

Renames a table.

```js
await Schema.rename('old_name', 'new_name');
```

---

### Introspection

These methods query `information_schema` and do not modify the database.

```js
Schema.hasTable(tableName)         → Promise<boolean>
Schema.hasColumn(tableName, column) → Promise<boolean>
Schema.getColumns(tableName)        → Promise<string[]>
```

**Examples:**

```js
if (await Schema.hasTable('users')) {
  console.log('users table exists');
}

if (await Schema.hasColumn('users', 'phone')) {
  console.log('phone column exists');
}

const cols = await Schema.getColumns('users');
// ['id', 'name', 'email', 'created_at', 'updated_at']
```

---

## Column Types Reference

All column methods return a `ColumnBuilder` so modifiers can be chained.

### Integer Types

| Method | SQL Type | Notes |
|---|---|---|
| `tinyInteger(name)` | `TINYINT` | |
| `boolean(name)` | `BOOLEAN` | Alias for TINYINT(1) |
| `smallInteger(name)` | `SMALLINT` | |
| `mediumInteger(name)` | `MEDIUMINT` | |
| `integer(name)` / `int(name)` | `INT` | |
| `bigInteger(name)` | `BIGINT` | |
| `increments(name = 'id')` | `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | Shorthand for standard PK |
| `bigIncrements(name = 'id')` | `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | |
| `bit(name, length = 1)` | `BIT(n)` | |

### Decimal / Float Types

| Method | SQL Type |
|---|---|
| `decimal(name, precision = 10, scale = 2)` | `DECIMAL(p,s)` |
| `numeric(name, precision = 10, scale = 2)` | `NUMERIC(p,s)` |
| `float(name, precision = null)` | `FLOAT` / `FLOAT(p)` |
| `double(name, precision = null, scale = null)` | `DOUBLE` / `DOUBLE(p,s)` |
| `real(name)` | `REAL` |

### Date & Time Types

| Method | SQL Type |
|---|---|
| `date(name)` | `DATE` |
| `datetime(name, fsp = 0)` | `DATETIME` / `DATETIME(fsp)` |
| `timestamp(name, fsp = 0)` | `TIMESTAMP` / `TIMESTAMP(fsp)` |
| `time(name, fsp = 0)` | `TIME` / `TIME(fsp)` |
| `year(name)` | `YEAR` |
| `timestamps()` | Adds `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` and `updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP` |

### String Types

| Method | SQL Type |
|---|---|
| `char(name, length = 1)` | `CHAR(n)` |
| `string(name, length = 255)` / `varchar(name, length = 255)` | `VARCHAR(n)` |
| `tinyText(name)` | `TINYTEXT` |
| `text(name)` | `TEXT` |
| `mediumText(name)` | `MEDIUMTEXT` |
| `longText(name)` | `LONGTEXT` |

### Binary / Blob Types

| Method | SQL Type |
|---|---|
| `binary(name, length = 1)` | `BINARY(n)` |
| `varBinary(name, length = 255)` | `VARBINARY(n)` |
| `tinyBlob(name)` | `TINYBLOB` |
| `blob(name)` | `BLOB` |
| `mediumBlob(name)` | `MEDIUMBLOB` |
| `longBlob(name)` | `LONGBLOB` |

### Spatial Types

| Method | SQL Type |
|---|---|
| `geometry(name)` | `GEOMETRY` |
| `point(name)` | `POINT` |
| `lineString(name)` | `LINESTRING` |
| `polygon(name)` | `POLYGON` |
| `multiPoint(name)` | `MULTIPOINT` |
| `multiLineString(name)` | `MULTILINESTRING` |
| `multiPolygon(name)` | `MULTIPOLYGON` |
| `geometryCollection(name)` | `GEOMETRYCOLLECTION` |

### Other Types

| Method | SQL Type |
|---|---|
| `json(name)` | `JSON` |
| `enum(name, ...values)` | `ENUM('a','b',...)` |

```js
t.enum('status', 'draft', 'published', 'archived');
// or pass an array
t.enum('status', ['draft', 'published', 'archived']);
```

---

## Column Modifiers

All modifiers return the `ColumnBuilder` instance for chaining.

| Modifier | Description |
|---|---|
| `.nullable()` | Allows `NULL` values |
| `.notNullable()` | Enforces `NOT NULL` (default for most columns) |
| `.default(value)` | Sets a `DEFAULT` value. Pass `'CURRENT_TIMESTAMP'`, `'NOW()'`, or `'UUID()'` to use raw SQL functions |
| `.unique()` | Adds a `UNIQUE` constraint |
| `.primary()` | Marks as `PRIMARY KEY` |
| `.autoIncrement()` | Adds `AUTO_INCREMENT` and sets as primary key |
| `.unsigned()` | Adds `UNSIGNED` (numeric columns only) |
| `.zerofill()` | Adds `ZEROFILL` (also implies `UNSIGNED`) |
| `.charset(value)` | Sets `CHARACTER SET` |
| `.collate(value)` | Sets `COLLATE` |
| `.comment(text)` | Adds a column `COMMENT` |
| `.check(expr)` | Adds a `CHECK` constraint |
| `.invisible()` | Marks the column as `INVISIBLE` |
| `.after(columnName)` | Places the column `AFTER` the specified column (useful in `ALTER`) |
| `.generatedAs(expr, stored = false)` | Creates a generated/computed column — `VIRTUAL` by default, pass `true` for `STORED` |
| `.references(table, col = 'id', onDelete = 'RESTRICT', onUpdate = 'RESTRICT')` | Adds a `FOREIGN KEY` constraint |

**Examples:**

```js
// Nullable with default
t.string('nickname', 50).nullable().default('Anonymous');

// Foreign key with cascade
t.integer('user_id').unsigned().references('users', 'id', 'CASCADE', 'CASCADE');

// Generated column
t.string('full_name').generatedAs("CONCAT(first_name, ' ', last_name)");

// Stored generated column
t.decimal('total', 10, 2).generatedAs('price * quantity', true);

// Raw SQL default
t.timestamp('published_at').default('CURRENT_TIMESTAMP');
```

---

## Table-Level Constraints & Indexes

These are called on the `TableBuilder` (inside `Schema.create`).

| Method | Description |
|---|---|
| `t.uniqueComposite(...cols)` | Adds a composite `UNIQUE KEY` across multiple columns |
| `t.primaryComposite(...cols)` | Adds a composite `PRIMARY KEY` |
| `t.addIndex(cols, name = null)` | Adds a regular `INDEX` |
| `t.fullText(cols, name = null)` | Adds a `FULLTEXT INDEX` |
| `t.spatialIndex(cols, name = null)` | Adds a `SPATIAL INDEX` |
| `t.engine(name)` | Sets storage engine (default: `InnoDB`) |
| `t.charset(charset)` | Sets table character set (default: `utf8mb4`) |
| `t.collate(collation)` | Sets table collation (default: `utf8mb4_unicode_ci`) |
| `t.comment(text)` | Adds a table-level comment |

```js
await Schema.create('order_items', (t) => {
  t.integer('order_id').unsigned();
  t.integer('product_id').unsigned();
  t.integer('qty').default(1);

  t.primaryComposite('order_id', 'product_id');
  t.addIndex(['order_id', 'product_id']);
  t.engine('InnoDB').charset('utf8mb4');
});
```

---

## AlterBuilder Operations

All operations inside `Schema.table(...)` use `AlterBuilder`. Multiple operations are batched into a single `ALTER TABLE` statement.

### Add Column

Use any of the column type methods directly on the `AlterBuilder`. All column modifiers apply.

```js
await Schema.table('users', (t) => {
  t.string('avatar_url', 500).nullable().after('email');
  t.tinyInteger('is_admin').default(0).after('active');
});
```

### Modify Column

Redefine an existing column's type and modifiers completely.

```js
await Schema.table('users', (t) => {
  t.modify('email').string(null, 200).notNullable().unique();
  t.modify('status').enum(null, 'active', 'inactive', 'banned').default('active');
});
```

> **Note:** The column name is passed to `modify()`. The name argument inside the type method (first param) is ignored.

### Drop Column

```js
await Schema.table('users', (t) => {
  t.dropColumn('legacy_field');
});
```

### Rename Column

Requires MySQL 8.0+.

```js
await Schema.table('users', (t) => {
  t.renameColumn('bio', 'about');
});
```

### Index Operations

| Method | Description |
|---|---|
| `t.addIndex(cols, indexName = null)` | Add a regular index |
| `t.addUniqueIndex(cols, indexName = null)` | Add a unique index |
| `t.addFullText(cols, indexName = null)` | Add a fulltext index |
| `t.dropIndex(indexName)` | Drop an index by name |
| `t.dropPrimary()` | Drop the primary key |

```js
await Schema.table('posts', (t) => {
  t.addIndex('slug');
  t.addUniqueIndex(['user_id', 'slug'], 'uq_posts_user_slug');
  t.addFullText(['title', 'body']);
  t.dropIndex('idx_posts_old_field');
});
```

### Foreign Key Operations

| Method | Description |
|---|---|
| `t.addForeign(column, foreignTable, foreignCol = 'id', onDelete = 'RESTRICT', onUpdate = 'RESTRICT')` | Add a foreign key constraint |
| `t.dropForeign(constraintName)` | Drop a foreign key by constraint name |

```js
await Schema.table('posts', (t) => {
  t.addForeign('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
  t.dropForeign('fk_posts_old_column');
});
```

---

## Return Value

All `Schema` methods return an object:

```js
{
  is_error: boolean,   // true if the query failed
  message:  string,    // human-readable success or error message
  sql:      string     // the SQL string that was executed (create/table only)
}
```

```js
const result = await Schema.create('products', (t) => {
  t.increments('id');
  t.string('name');
  t.timestamps();
});

if (result.is_error) {
  console.error(result.message);
} else {
  console.log(result.message);  // ✔ Table "products" created successfully.
  console.log(result.sql);      // CREATE TABLE IF NOT EXISTS `products` ( ...
}
```