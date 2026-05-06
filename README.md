# Kalva Framework Documentation

Kalva is a Node.js framework for building backend applications with a structured architecture, a simple CLI, a fluent schema builder, and an expressive model query API.

---

## Table of Contents

1. [CLI — Project & File Generation](#1-cli--project--file-generation)
2. [Schema — Migrations & Table Definitions](#2-schema--migrations--table-definitions)
3. [Model — Querying the Database](#3-model--querying-the-database)

---

# 1. CLI — Project & File Generation

## Installation & Project Setup

### Install the CLI on your machine

Install the Kalva CLI on your machine to start new projects and manage files. This command makes the CLI available globally so you can use it from any location.

```bash
npm install kalva.js -g 
```

### Create a New Project

```bash
kalva create-project <project-name>
```

This is the starting point. It will interactively prompt you to:
1. Choose a database (currently only **MySQL** is supported)
2. Enter your database connection details

It then scaffolds the full project structure, creates a `.env` file, and runs `npm install` automatically.

**Example:**
```bash
kalva create-project my-app
```

**Generated project structure:**
```
my-app/
├── app/
│   ├── raw/
│   └── builder.js
├── core/
│   ├── helper.js
│   └── server.js
├── database/
│   ├── connection.js
│   ├── model.js
│   ├── query-builder.js
│   └── schema.js
├── routes/
│   ├── api/
│   └── web/
├── .env
└── package.json
```

> ⚠️ All other commands must be run **inside** the project directory.

---

## Database Migrations (Tables)

### Create a Migration File

```bash
kalva create-table <table-name>
```

Creates a new migration file in `app/raw/` and registers it in `app/builder.js`.

```bash
kalva create-table users
```

---

### Update a Table (Add Column Migration)

```bash
kalva update-table <table-name>
```

Creates an update migration file for an existing table.

```bash
kalva update-table users
```

---

### Drop a Table (Drop Migration)

```bash
kalva drop-table <table-name>
```

Creates a drop migration file for the specified table.

```bash
kalva drop-table users
```

---

### Run Pending Migrations

```bash
kalva build-tables
```

Executes all pending (unbuilt) migration files by running `app/builder.js`. Only migrations with `status: false` are executed.

---

### Delete a Migration File

```bash
kalva delete-table <table-name>
```

Removes the migration file from `app/raw/` and unregisters it from `app/builder.js` and `package.json`.

```bash
kalva delete-table users
```

---

## Models

### Create a Model

```bash
kalva create-model <model-name>
```

Creates a new model file at `app/models/<name>-model.js`.

```bash
kalva create-model user
# Creates: app/models/user-model.js
# Exports:  UserModel
```

---

### Delete a Model

```bash
kalva delete-model <model-name>
```

Removes the model file and its entry from `package.json`.

---

## Controllers

### Create a Controller

```bash
kalva create-controller <controller-name>
```

Creates `app/controllers/<name>-controller.js`.

```bash
kalva create-controller user
# Exports: UserController
```

### Delete a Controller

```bash
kalva delete-controller <controller-name>
```

---

## Services

### Create a Service

```bash
kalva create-service <service-name>
```

Creates `app/services/<name>-service.js`.

```bash
kalva create-service user
# Exports: UserService
```

### Delete a Service

```bash
kalva delete-service <service-name>
```

---

## Middlewares

### Create a Middleware

```bash
kalva create-middleware <middleware-name>
```

Creates `app/middlewares/<name>-middleware.js`.

```bash
kalva create-middleware auth
# Creates: app/middlewares/auth-middleware.js
```

### Delete a Middleware

```bash
kalva delete-middleware <middleware-name>
```

---

## Routes

### Create a Web Route File

```bash
kalva create-web <name>
# Creates: routes/web/<name>.js
```

### Delete a Web Route File

```bash
kalva delete-web <name>
```

### Create an API Route File

```bash
kalva create-api <name>
# Creates: routes/api/<name>.js
```

### Delete an API Route File

```bash
kalva delete-api <name>
```

---

## Resources (Bulk Generation)

### Create a Resource

```bash
kalva create-resource <name>
```

A shortcut that generates three files at once:
- `app/models/<name>-model.js`
- `app/services/<name>-service.js` (linked to the model)
- `app/controllers/<name>-controller.js` (linked to the service)

```bash
kalva create-resource product
```

### Delete a Resource

```bash
kalva delete-resource <name>
```

Removes the model, service, and controller files together.

---

## Reset

```bash
kalva reset [type]
```

Resets project files. Defaults to `all` if no type is given.

| Type     | Description                    |
|----------|--------------------------------|
| `all`    | Resets all tables (migrations) |
| `tables` | Resets migration files only    |

> ⚠️ This deletes migration files from `app/raw/` and cleans up `app/builder.js` and `package.json`. Use with caution.

---

## CLI Quick Reference

| Command                          | Description                                 |
|----------------------------------|---------------------------------------------|
| `kalva create-project <name>`    | Scaffold a new Kalva project                |
| `kalva create-table <name>`      | Create a migration file                     |
| `kalva update-table <name>`      | Create an update migration                  |
| `kalva drop-table <name>`        | Create a drop migration                     |
| `kalva build-tables`             | Run all pending migrations                  |
| `kalva delete-table <name>`      | Delete a migration file                     |
| `kalva create-model <name>`      | Create a model                              |
| `kalva delete-model <name>`      | Delete a model                              |
| `kalva create-controller <name>` | Create a controller                         |
| `kalva delete-controller <name>` | Delete a controller                         |
| `kalva create-service <name>`    | Create a service                            |
| `kalva delete-service <name>`    | Delete a service                            |
| `kalva create-middleware <name>` | Create a middleware                         |
| `kalva delete-middleware <name>` | Delete a middleware                         |
| `kalva create-web <name>`        | Create a web route file                     |
| `kalva delete-web <name>`        | Delete a web route file                     |
| `kalva create-api <name>`        | Create an API route file                    |
| `kalva delete-api <name>`        | Delete an API route file                    |
| `kalva create-resource <name>`   | Create model + service + controller at once |
| `kalva delete-resource <name>`   | Delete model + service + controller         |
| `kalva reset [type]`             | Reset project files (tables, all)           |

> All commands except `create-project` must be run from inside a Kalva project directory — one that has `"project_type": "kalva"` in its `package.json`.

---

---

# 2. Schema — Migrations & Table Definitions

The `Schema` class is used inside migration files (generated by `kalva create-table`) to define and manage your database tables. It wraps a fluent `TableBuilder` / `AlterBuilder` API that produces MySQL SQL statements.

**Import:**
```js
var { Schema } = require("./../../database/schema");
```

---

## Schema Methods

### `Schema.create(name, callback)` — Create a Table

Creates a new table using `CREATE TABLE IF NOT EXISTS`.

```js
await Schema.create('users', (table) => {
    table.increments('id');
    table.string('name').notNullable();
    table.string('email', 100).unique();
    table.boolean('active').default(1);
    table.timestamps();
});
```

The `callback` receives a `TableBuilder` instance. Define your columns inside it. Returns `{ is_error, message, sql }`.

---

### `Schema.table(name, callback)` — Alter a Table

Modifies an existing table using `ALTER TABLE`.

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

### `Schema.drop(name)` — Drop a Table

Drops a table with `DROP TABLE IF EXISTS`.

```js
await Schema.drop('users');
```

---

### `Schema.rename(from, to)` — Rename a Table

```js
await Schema.rename('users', 'members');
```

---

### `Schema.hasTable(name)` — Check if a Table Exists

Returns `true` or `false`.

```js
const exists = await Schema.hasTable('users');
```

---

### `Schema.hasColumn(table, column)` — Check if a Column Exists

```js
const exists = await Schema.hasColumn('users', 'email');
```

---

### `Schema.getColumns(table)` — Get All Column Names

Returns an array of column name strings in ordinal order.

```js
const cols = await Schema.getColumns('users');
// ['id', 'name', 'email', 'created_at', 'updated_at']
```

---

## TableBuilder — Column Types

All column methods return a `ColumnBuilder` so you can chain modifiers (see below).

### Integers

| Method | MySQL Type | Notes |
|---|---|---|
| `t.increments('id')` | `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | Standard auto-increment ID |
| `t.bigIncrements('id')` | `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | Large auto-increment ID |
| `t.integer(name)` / `t.int(name)` | `INT` | |
| `t.tinyInteger(name)` | `TINYINT` | |
| `t.smallInteger(name)` | `SMALLINT` | |
| `t.mediumInteger(name)` | `MEDIUMINT` | |
| `t.bigInteger(name)` | `BIGINT` | |
| `t.boolean(name)` | `BOOLEAN` | |
| `t.bit(name, length)` | `BIT(n)` | Default length 1 |

### Decimals & Floats

| Method | MySQL Type |
|---|---|
| `t.decimal(name, precision, scale)` | `DECIMAL(10,2)` |
| `t.numeric(name, precision, scale)` | `NUMERIC(10,2)` |
| `t.float(name)` | `FLOAT` |
| `t.double(name, precision, scale)` | `DOUBLE` |
| `t.real(name)` | `REAL` |

### Strings & Text

| Method | MySQL Type | Notes |
|---|---|---|
| `t.char(name, length)` | `CHAR(n)` | Default 1 |
| `t.string(name, length)` / `t.varchar(name, length)` | `VARCHAR(n)` | Default 255 |
| `t.tinyText(name)` | `TINYTEXT` | |
| `t.text(name)` | `TEXT` | |
| `t.mediumText(name)` | `MEDIUMTEXT` | |
| `t.longText(name)` | `LONGTEXT` | |

### Binary & Blob

| Method | MySQL Type |
|---|---|
| `t.binary(name, length)` | `BINARY(n)` |
| `t.varBinary(name, length)` | `VARBINARY(n)` |
| `t.tinyBlob(name)` | `TINYBLOB` |
| `t.blob(name)` | `BLOB` |
| `t.mediumBlob(name)` | `MEDIUMBLOB` |
| `t.longBlob(name)` | `LONGBLOB` |

### Date & Time

| Method | MySQL Type | Notes |
|---|---|---|
| `t.date(name)` | `DATE` | |
| `t.datetime(name, fsp)` | `DATETIME(fsp)` | fsp = fractional seconds |
| `t.timestamp(name, fsp)` | `TIMESTAMP(fsp)` | |
| `t.time(name, fsp)` | `TIME(fsp)` | |
| `t.year(name)` | `YEAR` | |
| `t.timestamps()` | Adds `created_at` + `updated_at` | Shorthand for both timestamp columns |

### Other

| Method | MySQL Type |
|---|---|
| `t.json(name)` | `JSON` |
| `t.enum(name, ...values)` | `ENUM('a','b',...)` |
| `t.geometry(name)` | `GEOMETRY` |
| `t.point(name)` | `POINT` |
| `t.polygon(name)` | `POLYGON` |

---

## ColumnBuilder — Modifiers

Every column method returns a `ColumnBuilder`. You can chain these modifiers:

| Modifier | Description |
|---|---|
| `.nullable()` | Allows NULL values |
| `.notNullable()` | Disallows NULL (default) |
| `.default(value)` | Sets a default value (`'text'`, `1`, `'CURRENT_TIMESTAMP'`) |
| `.unique()` | Adds a UNIQUE constraint |
| `.primary()` | Marks as PRIMARY KEY |
| `.autoIncrement()` | Adds AUTO_INCREMENT (also sets primary) |
| `.unsigned()` | Adds UNSIGNED |
| `.zerofill()` | Adds ZEROFILL (also sets unsigned) |
| `.charset(v)` | Sets CHARACTER SET |
| `.collate(v)` | Sets COLLATE |
| `.comment(v)` | Adds a column COMMENT |
| `.check(expr)` | Adds a CHECK constraint |
| `.after(col)` | Places column AFTER another column |
| `.invisible()` | Marks column as INVISIBLE |
| `.generatedAs(expr, stored)` | Creates a generated/computed column |
| `.references(table, col, onDelete, onUpdate)` | Adds a FOREIGN KEY |

**For Examples:** 

```js
// Nullable with default
t.string('nickname', 50).nullable().default('guest');

// Foreign key
t.integer('user_id').unsigned().references('users', 'id', 'CASCADE', 'CASCADE');

// Enum
t.enum('status', 'active', 'inactive', 'banned').default('active');

// Generated column
t.string('full_name', 200).generatedAs("`first_name` || ' ' || `last_name`");

// Timestamps (shorthand)
t.timestamps();
// Equivalent to:
// t.timestamp('created_at').default('CURRENT_TIMESTAMP');
// t.timestamp('updated_at').nullable();  // with ON UPDATE CURRENT_TIMESTAMP
```

---

## TableBuilder — Table-Level Options

```js
await Schema.create('articles', (t) => {
    t.increments('id');
    t.string('title');
    t.text('body');
    t.timestamps();

    // Composite constraints
    t.uniqueComposite('user_id', 'slug');
    t.primaryComposite('tenant_id', 'user_id');

    // Indexes
    t.addIndex('title');
    t.fullText(['title', 'body']);

    // Table options
    t.engine('InnoDB');
    t.charset('utf8mb4');
    t.collate('utf8mb4_unicode_ci');
    t.comment('Stores blog articles');
});
```

| Method | Description |
|---|---|
| `t.uniqueComposite(...cols)` | Composite UNIQUE KEY |
| `t.primaryComposite(...cols)` | Composite PRIMARY KEY |
| `t.addIndex(cols, name?)` | Add an INDEX |
| `t.fullText(cols, name?)` | Add a FULLTEXT INDEX |
| `t.spatialIndex(cols, name?)` | Add a SPATIAL INDEX |
| `t.engine(name)` | Set table engine (default: InnoDB) |
| `t.charset(v)` | Set DEFAULT CHARSET |
| `t.collate(v)` | Set COLLATE |
| `t.comment(text)` | Set table COMMENT |

---

## AlterBuilder — Modifying Existing Tables

Used inside `Schema.table()`. Supports all the same column types as `TableBuilder`, plus:

| Method | Description |
|---|---|
| `t.dropColumn(name)` | `DROP COLUMN` |
| `t.renameColumn(from, to)` | `RENAME COLUMN` (MySQL 8.0+) |
| `t.modify(name).type(...)` | `MODIFY COLUMN` — redefine a column fully |
| `t.addIndex(cols, name?)` | `ADD INDEX` |
| `t.addUniqueIndex(cols, name?)` | `ADD UNIQUE KEY` |
| `t.addFullText(cols, name?)` | `ADD FULLTEXT INDEX` |
| `t.dropIndex(name)` | `DROP INDEX` |
| `t.dropPrimary()` | `DROP PRIMARY KEY` |
| `t.addForeign(col, table, fCol, onDelete, onUpdate)` | `ADD FOREIGN KEY` |
| `t.dropForeign(constraintName)` | `DROP FOREIGN KEY` |

**Example:**

```js
await Schema.table('users', (t) => {
    // Add new columns
    t.string('avatar', 300).nullable().after('email');
    t.tinyInteger('role').default(1);

    // Modify an existing column
    t.modify('name').string(null, 200).notNullable();

    // Remove a column
    t.dropColumn('legacy_token');

    // Rename a column
    t.renameColumn('bio', 'about');

    // Add a foreign key
    t.addForeign('role_id', 'roles', 'id', 'CASCADE', 'SET NULL');

    // Drop a foreign key
    t.dropForeign('fk_users_role_id');
});
```

---

## Full Migration File Example

This is the pattern used by migration files generated with `kalva create-table`:

```js
var { Schema } = require("./../../database/schema");

// Helper to add standard columns to every table
function BuildColumns(table) {
    table.increments('id');   // id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    table.timestamps();       // created_at + updated_at
}

async function usersSchema() {
    return await Schema.create('users', (table) => {
        BuildColumns(table);                          // id, created_at, updated_at
        table.string('name').notNullable();
        table.string('email', 100).unique().notNullable();
        table.string('password').notNullable();
        table.boolean('active').default(1);
    });
}

module.exports = { usersSchema };
```

---

---

# 3. Model — Querying the Database

The `Model` class is the base class for all Kalva models. It provides a fluent, chainable query builder API. Every model file generated by `kalva create-model` extends it.

**Your model file (`app/models/user-model.js`):**

```js
var { Model } = require('./../../database/model');

class UserModel extends Model {
    static table       = 'users';
    static primary_key = 'id';
    static fillable    = ['name', 'email', 'password', 'active'];
}

module.exports = { UserModel };
```

| Property | Description |
|---|---|
| `static table` | The database table name this model maps to |
| `static primary_key` | Primary key column (default: `id`) |
| `static fillable` | Columns allowed for mass assignment in `create()` / `update()` |

---

## Fetching Records

### `.all()` — Get All Rows

```js
const result = await UserModel.all().get();
```

### `.find()` — Get All Rows (alias for `all()`)

```js
const result = await UserModel.find().get();
```

### `.findById(id)` — Find by Primary Key

```js
const result = await UserModel.findById(5).get();
```

### `.findOrFail(id)` — Find by Primary Key or Throw

Returns an error result if the record doesn't exist.

```js
const result = await UserModel.findOrFail(5).get();
```

### `.findBy(column, value)` — Find by Any Column

```js
const result = await UserModel.findBy('email', 'ali@example.com').get();
```

### `.findOne(condition)` — Find Single Record by Condition

```js
const result = await UserModel.findOne({ email: 'ali@example.com' }).get();
```

### `.findAll(column, value)` — Find Multiple Records by Column

```js
const result = await UserModel.findAll('active', 1).get();
```

### `.first()` — Get the First Record

```js
const result = await UserModel.first().get();
```

### `.last()` — Get the Last Record

```js
const result = await UserModel.last().get();
```

### `.paginate(page, perPage)` — Paginate Results

```js
const result = await UserModel.paginate(1, 20).get();
```

---

## WHERE Conditions

All `where` methods are chainable with each other.

### `.where(column, value)`

```js
const result = await UserModel.where('active', 1).get();
```

### `.whereOp(column, operator, value)` — With Custom Operator

```js
const result = await UserModel.whereOp('age', '>=', 18).get();
```

### `.whereOpColumns(left, right, operator)` — Compare Two Columns

```js
const result = await UserModel.whereOpColumns('created_at', 'updated_at', '<').get();
```

### `.orWhere(column, value)` / `.orWhereOp(column, operator, value)`

```js
const result = await UserModel
    .where('role', 'admin')
    .orWhere('role', 'moderator')
    .get();
```

### `.andWhere(column, value)`

```js
const result = await UserModel
    .where('active', 1)
    .andWhere('verified', 1)
    .get();
```

### `.whereIn(column, values)` / `.whereNotIn(column, values)`

```js
const result = await UserModel.whereIn('id', [1, 2, 3]).get();
const result2 = await UserModel.whereNotIn('role', ['banned', 'suspended']).get();
```

### `.whereNull(column)` / `.whereNotNull(column)`

```js
const result = await UserModel.whereNull('deleted_at').get();
```

### `.whereBetween(column, min, max)` / `.whereNotBetween(column, min, max)`

```js
const result = await UserModel.whereBetween('age', 18, 65).get();
```

### `.whereLike(column, value, type)` / `.whereILike(column, value, type)`

`type` can be `'contains'`, `'starts'`, or `'ends'`. `whereILike` is case-insensitive.

```js
const result = await UserModel.whereLike('name', 'ali', 'starts').get();
```

### `.whereRaw(sql, bindings)` — Raw WHERE Clause

```js
const result = await UserModel.whereRaw('YEAR(created_at) = ?', [2024]).get();
```

---

## SELECT, ORDER, GROUP, LIMIT

### `.select(columns)` — Choose Columns

```js
const result = await UserModel.select(['id', 'name', 'email']).get();
```

### `.distinct()`

```js
const result = await UserModel.distinct().select(['country']).get();
```

### `.orderBy(column, direction)` / `.orderByAsc(column)` / `.orderByDesc(column)`

```js
const result = await UserModel.orderByDesc('created_at').get();
const result2 = await UserModel.orderBy('name', 'ASC').get();
```

### `.groupBy(column)`

```js
const result = await UserModel.groupBy('country').select(['country']).count('id', 'total').get();
```

### `.having(sql, bindings)`

```js
const result = await UserModel
    .groupBy('role')
    .having('COUNT(id) > ?', [5])
    .get();
```

### `.limit(number)` / `.offset(number)`

```js
const result = await UserModel.limit(10).offset(20).get();
```

---

## JOINS

All join methods take `(table, leftColumn, operator, rightColumn)`.

| Method | SQL Type |
|---|---|
| `.join(table, left, op, right)` | `INNER JOIN` (default) |
| `.innerJoin(table, left, op, right)` | `INNER JOIN` |
| `.leftJoin(table, left, op, right)` | `LEFT JOIN` |
| `.rightJoin(table, left, op, right)` | `RIGHT JOIN` |
| `.outerJoin(table, left, op, right)` | `OUTER JOIN` |
| `.fullJoin(table, left, op, right)` | `FULL JOIN` |

```js
const result = await UserModel
    .leftJoin('roles', 'users.role_id', '=', 'roles.id')
    .select(['users.*', 'roles.name as role_name'])
    .get();
```

---

## RELATIONSHIPS

### `.with(column, relation, type)` — Eager Load a Relationship

```js
const result = await UserModel.with('posts', PostModel).get();
// type defaults to 'LEFT'
```

### `.withCount(column, relation)` — Count Related Records

```js
const result = await UserModel.withCount('posts', PostModel).get();
```

---

## AGGREGATE Functions

All aggregate methods accept an optional `alias` parameter.

```js
const count  = await UserModel.count('id', 'total').get();
const total  = await OrderModel.sum('amount', 'revenue').get();
const avg    = await OrderModel.avg('amount', 'average').get();
const lowest = await ProductModel.min('price', 'cheapest').get();
const top    = await ProductModel.max('price', 'most_expensive').get();
```

---

## Writing Data

### `.create(data)` — Insert a Record

Only columns listed in `fillable` are inserted.

```js
const result = await UserModel.create({
    name: 'Ali Hassan',
    email: 'ali@example.com',
    password: 'hashed_password',
    active: 1
});
```

---

### `.update(id, data)` — Update a Record by Primary Key

```js
const result = await UserModel.update(5, {
    name: 'Ali Updated',
    active: 0
});
```

---

### `.updateMany(data)` — Update Multiple Records Matching a WHERE

```js
const result = await UserModel
    .where('active', 0)
    .updateMany({ role: 'suspended' });
```

---

### `.save()` — Execute the Built Query

Used to run a query that has been built with chaining. Acts as the final execution step (similar to `.get()` but for write operations).

```js
await UserModel.where('id', 5).delete().save();
```

---

## Deleting Data

### `.deleteById(id)` — Delete by Primary Key

```js
const result = await UserModel.deleteById(5);
```

### `.deleteBy(data)` — Delete by a Condition Object

```js
const result = await UserModel.deleteBy({ email: 'old@example.com' });
```

### `.delete()` — Delete Records Matching WHERE

```js
const result = await UserModel.where('active', 0).delete().save();
```

### `.deleteMany(object)` — Delete Multiple by Conditions

```js
const result = await UserModel.deleteMany({ role: 'guest', active: 0 });
```

### `.truncate()` — Remove All Records from Table

```js
await UserModel.truncate().save();
```

---

## Executing a Query — `.get()` and `.save()`

| Method | Use for |
|---|---|
| `.get(columns?)` | Fetching records — SELECT queries |
| `.save()` | Write operations — INSERT, UPDATE, DELETE |

Both are `async` and return a result object: `{ is_error, message, data }`.

```js
// Read
const { is_error, data } = await UserModel.where('active', 1).get();

// Write
const { is_error, message } = await UserModel.create({ name: 'Test' });
```

---

## Full Usage Examples

```js
var { UserModel } = require('./../models/user-model');

// Get all active users, newest first
const users = await UserModel
    .where('active', 1)
    .orderByDesc('created_at')
    .limit(10)
    .get(['id', 'name', 'email']);

// Paginate
const page = await UserModel.paginate(2, 15).get();

// Join with roles table
const result = await UserModel
    .leftJoin('roles', 'users.role_id', '=', 'roles.id')
    .select(['users.id', 'users.name', 'roles.name as role'])
    .get();

// Create
await UserModel.create({
    name: 'Sara',
    email: 'sara@example.com',
    password: 'secret'
});

// Update
await UserModel.update(3, { active: 0 });

// Delete
await UserModel.deleteById(7);

// Aggregate
const { data } = await UserModel.count('id', 'total').get();
console.log(data[0].total);
```

---

## Notes

- All commands except `create-project` must be run from inside a Kalva project directory.
- Currently, **MySQL** is the only supported database driver.
- Kalva tracks all generated files inside `package.json` under the `kalva_data` array.
- All `Model` query methods are **static** — call them directly on the class, not on an instance.
- `.get()` and `.save()` are always the final step in a chain and are always `async`.