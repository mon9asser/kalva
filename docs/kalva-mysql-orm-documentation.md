# MySqlModel — ORM & Query Builder

A Laravel-inspired, chainable MySQL ORM for Node.js. Every query starts from a static method on your model class and returns a `QueryBuilder` you can keep chaining before executing.

---

## Table of Contents

- [Defining a Model](#defining-a-model)
- [Read — Querying](#read--querying)
  - [Fetch Methods](#fetch-methods)
  - [WHERE Clauses](#where-clauses)
  - [SELECT & DISTINCT](#select--distinct)
  - [JOIN](#join)
  - [ORDER, GROUP, HAVING](#order-group-having)
  - [LIMIT & OFFSET](#limit--offset)
  - [Aggregates](#aggregates)
  - [Pluck, KeyBy, Chunk, Paginate](#pluck-keyby-chunk-paginate)
- [Create](#create)
- [Update](#update)
- [Delete](#delete)
- [Instance Methods](#instance-methods)
- [Relations](#relations)
- [Scopes](#scopes)
- [Migrate & Seed](#migrate--seed)
- [Raw Queries](#raw-queries)

---

## Defining a Model

```js
const { MySqlModel } = require('./framework/database/model');

class User extends MySqlModel {
    static table      = 'users';
    static primaryKey = 'id';
    static fillable   = ['name', 'email', 'active'];  // mass-assignable
    static guarded    = [];                            // blocked from mass-assign

    // Relations
    async posts()   { return this.hasMany(Post, 'user_id'); }
    async profile() { return this.hasOne(Profile, 'user_id'); }
    async roles()   { return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id'); }
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `table` | `string` | `''` | MySQL table name |
| `primaryKey` | `string` | `'id'` | Primary key column |
| `fillable` | `string[]` | `[]` | Columns allowed in mass assignment |
| `guarded` | `string[]` | `[]` | Columns blocked from mass assignment |
| `scopes` | `object` | `{}` | Named local scopes |

---

## Read — Querying

### Fetch Methods

All fetch methods return a `Promise`. Chaining is available on every `where*`, `select`, `join`, `orderBy`, `limit`, etc. before calling a fetch method.

| Method | Returns | Description |
|---|---|---|
| `Model.all()` | `Promise<Model[]>` | Return every row |
| `Model.get()` | `Promise<Model[]>` | Execute and return all matching rows |
| `Model.first()` | `Promise<Model\|null>` | First matching row or `null` |
| `Model.last()` | `Promise<Model\|null>` | Last row by primary key or `null` |
| `Model.find(id)` | `Promise<Model\|null>` | Find by primary key |
| `Model.findById(id)` | `Promise<Model\|null>` | Alias for `find` |
| `Model.findOrFail(id)` | `Promise<Model>` | Find by PK — throws if not found |
| `Model.findBy(col, value)` | `Promise<Model\|null>` | First row matching column/value |
| `Model.findOne(conditions)` | `Promise<Model\|null>` | First row matching conditions object |
| `Model.findAll(col, value)` | `Promise<Model[]>` | All rows matching column/value |

```js
const user  = await User.find(1);
const admin = await User.findBy('email', 'admin@example.com');
const all   = await User.where('active', 1).orderBy('name').get();
const first = await User.where('active', 1).first();
```

---

### WHERE Clauses

All `where*` methods are chainable and combinable.

| Method | SQL produced |
|---|---|
| `.where(col, value)` | `col = ?` |
| `.whereOp(col, op, value)` | `col <op> ?` (e.g. `>`, `LIKE`) |
| `.orWhere(col, value)` | `OR col = ?` |
| `.orWhereOp(col, op, value)` | `OR col <op> ?` |
| `.andWhere(col, value)` | `AND col = ?` (alias for `where`) |
| `.whereIn(col, values)` | `col IN (?, ?, ...)` |
| `.whereNotIn(col, values)` | `col NOT IN (?, ?, ...)` |
| `.whereNull(col)` | `col IS NULL` |
| `.whereNotNull(col)` | `col IS NOT NULL` |
| `.whereBetween(col, min, max)` | `col BETWEEN ? AND ?` |
| `.whereNotBetween(col, min, max)` | `col NOT BETWEEN ? AND ?` |
| `.whereLike(col, pattern)` | `col LIKE ?` |
| `.whereILike(col, pattern)` | `LOWER(col) LIKE LOWER(?)` |
| `.whereRaw(sql, bindings)` | Raw SQL fragment |

```js
// Comparison operator
const adults = await User.whereOp('age', '>=', 18).get();

// IN / NOT IN
const users = await User.whereIn('role', ['admin', 'moderator']).get();

// NULL checks
const pending = await User.whereNull('verified_at').get();

// BETWEEN
const mid = await Product.whereBetween('price', 10, 50).get();

// Raw
const found = await User.whereRaw('YEAR(created_at) = ?', [2024]).get();

// Chained AND / OR
const result = await User
    .where('active', 1)
    .orWhere('role', 'admin')
    .orderBy('name')
    .get();
```

---

### SELECT & DISTINCT

```js
// Specific columns
const names = await User.select('id', 'name', 'email').where('active', 1).get();

// Raw expression
const stats = await User.select('role', 'COUNT(*) as total').groupBy('role').get();

// DISTINCT
const cities = await User.select('city').distinct().pluck('city');
```

---

### JOIN

| Method | SQL type |
|---|---|
| `.join(table, localCol, op, foreignCol)` | `INNER JOIN` |
| `.innerJoin(...)` | `INNER JOIN` |
| `.leftJoin(...)` | `LEFT JOIN` |
| `.rightJoin(...)` | `RIGHT JOIN` |
| `.outerJoin(...)` | `FULL OUTER JOIN` |
| `.fullJoin(...)` | `FULL OUTER JOIN` |
| `.joinRaw(sql)` | Raw JOIN fragment |

```js
const posts = await Post
    .select('posts.id', 'posts.title', 'users.name')
    .leftJoin('users', 'user_id', '=', 'id')
    .where('posts.active', 1)
    .get();
```

---

### ORDER, GROUP, HAVING

```js
// Order
await User.orderBy('name').get();
await User.orderByDesc('created_at').get();
await User.orderByRaw('FIELD(role, "admin", "user")').get();

// Group + Having
await Order
    .select('user_id', 'SUM(total) as revenue')
    .groupBy('user_id')
    .having('SUM(total) > ?', [1000])
    .get();
```

---

### LIMIT & OFFSET

```js
await User.limit(10).offset(20).get();
```

---

### Aggregates

| Method | Description |
|---|---|
| `.count(col = '*')` | `COUNT(col)` → number |
| `.sum(col)` | `SUM(col)` → number |
| `.avg(col)` | `AVG(col)` → number |
| `.min(col)` | `MIN(col)` → number |
| `.max(col)` | `MAX(col)` → number |
| `.exists()` | `true` if any row matches |
| `.doesntExist()` | `true` if no rows match |

```js
const total    = await User.where('active', 1).count();
const revenue  = await Order.where('status', 'paid').sum('total');
const avgScore = await Review.avg('rating');
const hasAdmins = await User.where('role', 'admin').exists();
```

---

### Pluck, KeyBy, Chunk, Paginate

**`pluck(col)`** — flat array of a single column's values:

```js
const emails = await User.where('active', 1).pluck('email');
// ['alice@example.com', 'bob@example.com', ...]
```

**`keyBy(col)`** — object indexed by column value:

```js
const usersById = await User.keyBy('id');
// { 1: User, 2: User, ... }
```

**`chunk(size, callback)`** — process large result sets in batches:

```js
await User.where('active', 1).chunk(100, async (batch) => {
    for (const user of batch) {
        await sendEmail(user.email);
    }
});
```

**`paginate(page, perPage)`** — returns pagination metadata with data:

```js
const result = await User.where('active', 1).orderBy('name').paginate(1, 15);

// result:
{
  data:         User[],
  total:        150,
  per_page:     15,
  current_page: 1,
  last_page:    10,
  from:         1,
  to:           15
}
```

---

## Create

| Method | Description |
|---|---|
| `Model.create(data)` | INSERT row, return hydrated instance |
| `Model.createOrIgnore(data)` | INSERT IGNORE — returns `null` on conflict |
| `Model.createMany(rows)` | INSERT multiple rows, returns `Model[]` |
| `Model.firstOrCreate(conditions, data)` | Find or create |
| `Model.updateOrCreate(conditions, data)` | Upsert via `ON DUPLICATE KEY UPDATE` |
| `Model.insert(data)` | Low-level INSERT, returns raw DB result |
| `Model.insertMany(rows)` | Low-level bulk INSERT |

```js
// Basic create
const user = await User.create({ name: 'Alice', email: 'alice@example.com', active: 1 });

// Insert or ignore duplicates
const result = await User.createOrIgnore({ email: 'alice@example.com', name: 'Alice' });
// returns null if email already exists (unique constraint)

// Bulk create
const users = await User.createMany([
    { name: 'Bob',   email: 'bob@example.com' },
    { name: 'Carol', email: 'carol@example.com' },
]);

// Find or create
const user = await User.firstOrCreate(
    { email: 'dave@example.com' },
    { name: 'Dave', active: 1 }
);

// Upsert
const user = await User.updateOrCreate(
    { email: 'alice@example.com' },
    { name: 'Alice Updated', active: 1 }
);
```

---

## Update

| Method | Description |
|---|---|
| `Model.update(id, data)` | UPDATE by PK, returns updated instance |
| `Model.updateMany(pairs)` | UPDATE multiple rows — `[[id, data], ...]` |
| `Model.updateWhere(conditions, data)` | UPDATE rows matching conditions |
| `qb.updateWhere(data)` | UPDATE rows matching current QueryBuilder WHERE |
| `instance.update(data)` | Update instance fields and persist |
| `instance.increment(col, amount)` | Increment column on instance |
| `instance.decrement(col, amount)` | Decrement column on instance |
| `Model.increment(col, amount)` | Increment matching rows (QueryBuilder) |
| `Model.decrement(col, amount)` | Decrement matching rows (QueryBuilder) |

```js
// Update by PK
const updated = await User.update(1, { name: 'Alice Smith' });

// Bulk update
await User.updateMany([
    [1, { active: 0 }],
    [2, { active: 0 }],
]);

// Update by conditions
await User.updateWhere({ role: 'guest' }, { active: 0 });

// QueryBuilder-level update
await User.where('last_login', null).whereOp('created_at', '<', '2023-01-01').updateWhere({ active: 0 });

// Increment/decrement
await Post.where('id', 5).increment('views', 1);
await User.where('id', 1).decrement('credits', 10);
```

---

## Delete

| Method | Description |
|---|---|
| `Model.delete(id)` | DELETE by PK |
| `Model.destroy(id)` | Alias for `delete` |
| `Model.deleteMany(ids)` | DELETE multiple PKs |
| `Model.deleteWhere(conditions)` | DELETE rows matching conditions |
| `qb.deleteWhere()` | DELETE rows matching current QueryBuilder WHERE |
| `Model.truncate()` | TRUNCATE the entire table |
| `instance.delete()` | Delete this instance |

```js
await User.delete(1);
await User.deleteMany([1, 2, 3]);
await User.deleteWhere({ active: 0 });

// QueryBuilder-level delete
await User.whereNull('verified_at').whereOp('created_at', '<', '2022-01-01').deleteWhere();

// Truncate
await Session.truncate();
```

---

## Instance Methods

Once you have a model instance (from `find`, `create`, etc.) you can call these directly:

| Method | Description |
|---|---|
| `instance.save()` | INSERT if new, UPDATE if already persisted |
| `instance.update(data)` | Merge data into instance and `save()` |
| `instance.delete()` | Delete this row from the database |
| `instance.refresh()` | Reload this instance from the database |
| `instance.reload()` | Alias for `refresh()` |
| `instance.increment(col, amount)` | Increment column, update local property |
| `instance.decrement(col, amount)` | Decrement column, update local property |
| `instance.toJSON()` | Serialize to plain object (strips `_` internals) |
| `instance.toArray()` | Serialize to `[key, value]` pairs |

```js
// Manual create + save
const user    = new User({ name: 'Eve', email: 'eve@example.com' });
await user.save();   // INSERT

// Update
await user.update({ name: 'Eve Updated' });

// Increment
await user.increment('login_count');
console.log(user.login_count);  // updated in memory too

// Refresh from DB
await user.refresh();

// Serialize
const plain = user.toJSON();
```

---

## Relations

Define relations as `async` instance methods. Call them directly on an instance, or eager-load via `.with()`.

### belongsTo

This row has a FK pointing to a parent.

```js
class Post extends MySqlModel {
    static table = 'posts';

    async user() {
        return this.belongsTo(User, 'user_id');
    }
}

const post = await Post.find(1);
const user = await post.user();
```

### hasOne

This model's PK is referenced by a FK on a related table.

```js
class User extends MySqlModel {
    async profile() {
        return this.hasOne(Profile, 'user_id');
    }
}

const profile = await user.profile();
```

### hasMany

```js
class User extends MySqlModel {
    async posts() {
        return this.hasMany(Post, 'user_id');
    }
}

const posts = await user.posts();
```

### belongsToMany

Many-to-many via a pivot/junction table.

```js
class User extends MySqlModel {
    async roles() {
        return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
    }
}

const roles = await user.roles();
```

### Pivot operations

```js
// Attach role IDs (INSERT IGNORE)
await user.attach('user_roles', 'user_id', 'role_id', [1, 2, 3]);

// Detach specific IDs
await user.detach('user_roles', 'user_id', 'role_id', [2]);

// Detach all
await user.detach('user_roles', 'user_id', 'role_id');

// Sync — detach all, then attach
await user.sync('user_roles', 'user_id', 'role_id', [1, 3]);

// Attach with extra pivot data
await user.attach('user_roles', 'user_id', 'role_id', [1], [{ granted_at: '2024-01-01' }]);
```

### Eager loading

```js
// Load relation on result set
const posts = await Post.with('user').where('active', 1).get();
posts[0].user;  // already loaded

// Load count
const users = await User.withCount('posts').get();
users[0].posts_count;  // number

// Eager-load on a single instance
await post.eagerLoad('user');
```

---

## Scopes

### Local Scopes

Define named query shortcuts on the model:

```js
class User extends MySqlModel {
    static scopes = {
        active: (qb)       => qb.where('active', 1),
        role:   (qb, role) => qb.where('role', role),
    };
}

// Usage
const active = await User.scope('active').get();
const admins = await User.scope('role', 'admin').orderBy('name').get();
```

### Global Scopes

Applied automatically to every query on the model:

```js
User.globalScope('onlyActive', (qb) => qb.where('active', 1));

// All queries now include WHERE active = 1
const users = await User.all();
```

---

## Migrate & Seed

```js
class User extends MySqlModel {
    static table    = 'users';
    static fillable = ['name', 'email', 'active'];

    static async migrate() {
        return Schema.create('users', (t) => {
            t.increments('id');
            t.string('name', 100).notNullable();
            t.string('email', 150).unique();
            t.boolean('active').default(1);
            t.timestamps();
        });
    }
}

// Run migration
await User.migrate();

// Rollback (drops the table)
await User.rollbackMigration();

// Rollback ignoring FK checks
await User.rollbackMigration(true);

// Seed (uses createOrIgnore — safe to re-run)
await User.seed([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob',   email: 'bob@example.com' },
]);
// ✔ Seeded 2 rows. 0 skipped (conflict).
```

---

## Raw Queries

```js
// Via model
const result = await User.raw('SELECT * FROM users WHERE created_at > ?', ['2024-01-01']);
const same   = await User.query('SELECT * FROM users WHERE created_at > ?', ['2024-01-01']);

// Via QueryBuilder
const qb = User.where('active', 1);
await qb.raw('UPDATE users SET last_seen = NOW() WHERE active = 1');
```

---

## Return Values

Static CRUD methods return either a hydrated `MySqlModel` instance (or array), or for low-level operations a raw database result:

```js
{
  is_error:     boolean,
  message:      string,
  data:         object | object[],  // rows or insertId / affectedRows
}
```

`create`, `update`, `findOrFail`, and `updateOrCreate` throw on error rather than returning `is_error: true`.