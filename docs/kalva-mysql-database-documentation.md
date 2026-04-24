# Database — MySQL Connection Layer

A singleton, pool-based MySQL connection class built on `mysql2`. Handles all low-level database access for the ORM — pooling, transactions, health checks, and debug logging.

---

## Table of Contents

- [Setup](#setup)
- [Health Check](#health-check)
- [Querying](#querying)
- [Transactions](#transactions)
  - [Auto Transaction](#auto-transaction-recommended)
  - [Manual Transaction](#manual-transaction)
- [Pool Stats](#pool-stats)
- [Return Value](#return-value)
- [Environment Variables](#environment-variables)

---

## Setup

Load `.env` once at your app entry point before anything else imports `Database`:

```js
// server.js / app.js — top of file
require('dotenv').config();

const express = require('express');
// ... rest of your app
```

Then use `Database` anywhere:

```js
const { Database } = require('./framework/database/database');

const db = new Database();
```

> Calling `new Database()` multiple times always returns the same instance. The pool is created once and reused across the entire app.

---

## Health Check

```js
db.isConnected() → Promise<boolean>
```

Tests whether the pool can acquire a connection. Use this **only at startup** — not per request or per query.

```js
const db = new Database();

const ok = await db.isConnected();
if (!ok) {
    console.error('Cannot reach database. Check your .env config.');
    process.exit(1);
}

console.log('Database connected.');
app.listen(3000);
```

---

## Querying

```js
db.query(sql, params = []) → Promise<{ is_error, message, data }>
```

Executes a SQL string against the pool using `?` positional placeholders. All ORM methods use this internally.

```js
// SELECT
const result = await db.query('SELECT * FROM users WHERE active = ?', [1]);

if (result.is_error) {
    console.error(result.message);
} else {
    console.log(result.data);  // array of row objects
}

// INSERT
const insert = await db.query(
    'INSERT INTO users (name, email) VALUES (?, ?)',
    ['Alice', 'alice@example.com']
);
console.log(insert.data.insertId);

// UPDATE
await db.query('UPDATE users SET active = ? WHERE id = ?', [0, 5]);

// DELETE
await db.query('DELETE FROM users WHERE id = ?', [5]);
```

> Errors are caught internally and returned as `{ is_error: true, message: '...' }` — they never throw.

---

## Transactions

### Auto Transaction (Recommended)

```js
db.transaction(callback) → Promise<any>
```

Runs a callback on a **single dedicated connection**. Automatically commits if the callback resolves, rolls back if it throws. The connection is always released in `finally`.

```js
await db.transaction(async (tx) => {
    await tx.query(
        'INSERT INTO orders (user_id, total) VALUES (?, ?)',
        [1, 99.99]
    );
    await tx.query(
        'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
        [99.99, 1]
    );
});
```

If any `tx.query()` throws, all previous statements in the callback are rolled back automatically.

You can also return a value from the transaction:

```js
const order = await db.transaction(async (tx) => {
    const result = await tx.query(
        'INSERT INTO orders (user_id, total) VALUES (?, ?)',
        [1, 150]
    );
    const id = result.data.insertId;

    await tx.query(
        'INSERT INTO order_items (order_id, product_id) VALUES (?, ?)',
        [id, 42]
    );

    return id;
});

console.log('New order ID:', order);
```

---

### Manual Transaction

```js
db.beginTransaction() → Promise<{ query, commit, rollback, release }>
```

Returns a transaction object for explicit control. Use this when you need to pass the transaction across multiple functions or when control flow is complex.

**Always call `tx.release()` in your `finally` block** — otherwise the connection leaks back into the pool.

```js
const tx = await db.beginTransaction();

try {
    await tx.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [200, 1]
    );
    await tx.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [200, 2]
    );

    await tx.commit();

} catch (error) {
    await tx.rollback();
    console.error('Transfer failed:', error.message);

} finally {
    tx.release();
}
```

#### Transaction object methods

| Method | Description |
|---|---|
| `tx.query(sql, params)` | Run a query on this connection |
| `tx.commit()` | Commit all statements |
| `tx.rollback()` | Roll back all statements |
| `tx.release()` | Return the connection to the pool |

---

## Pool Stats

```js
db.poolStats() → { all, free, queued }
```

Returns a snapshot of the current pool state. Useful for a `/health` or `/status` endpoint.

```js
const stats = db.poolStats();
console.log(stats);
// { all: 4, free: 3, queued: 0 }
```

| Field | Description |
|---|---|
| `all` | Total connections created |
| `free` | Connections currently idle |
| `queued` | Queries waiting for a free connection |

---

## Return Value

All `query()` calls — both direct and inside transactions — return the same shape:

```js
{
  is_error: boolean,   // true if the query failed
  message:  string,    // 'success' or the error message
  data:     any        // array of rows (SELECT) or ResultSetHeader (INSERT/UPDATE/DELETE)
}
```

For write operations, `data` is a `ResultSetHeader`:

```js
{
  insertId:     number,   // last inserted ID (INSERT only)
  affectedRows: number,   // rows changed
  changedRows:  number,   // rows actually modified (UPDATE)
}
```

> `transaction()` does not wrap the return value — it returns whatever your callback returns directly.

---

## Environment Variables

Add these to your `.env` file:

```env
# Connection
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=secret
DATABASE_NAME=my_database

# Pool tuning (optional)
DATABASE_POOL_LIMIT=10      # max simultaneous connections (default: 10)
DATABASE_QUEUE_LIMIT=0      # max queued requests, 0 = unlimited (default: 0)

# Debug (optional)
DB_DEBUG=true               # logs every SQL statement and params to console
```

When `DB_DEBUG=true`, every query prints before it executes:

```
[SQL]    SELECT * FROM users WHERE active = ? [ 1 ]
[TX SQL] INSERT INTO orders (user_id) VALUES (?) [ 1 ]
[DB ERROR] { sql: '...', params: [...], message: '...' }
```