# Kalva

## Installation

Run this command to install the Kalva CLI globally on your machine.

```bash
npm install -g kalva
```

Run this command to create a new Kalva project.

```bash
kalva create-project <project-name>
```

---

## Schema (Blueprints)

The schema system supports the full table lifecycle. It handles:
- Table creation
- Table alteration
- Table deletion
- Table renaming
- Column management
- Index management
- Foreign key management
- Schema introspection

Once you finish building your schemas, push them to the database using:

```bash
kalva post-blueprints
```

### Creating a Blueprint

Creates a schema file inside the blueprint folder at `/blueprint/<schema-name>.js`. You define your table structure inside this file.

```bash
kalva create-blueprint <schema-name>
```

Replace `<schema-name>` with your table name, for example:

```bash
kalva create-blueprint user
```

This creates `/blueprint/user.js` with a structure like the following, depending on the database you selected when creating the project.

```js
// MySQL
await Schema.create("users", (t) => {
    t.increments("id");
    t.string("name", 150).notNullable();
    t.string("email", 100).unique();
    t.timestamps();
});
```

### Updating a Blueprint

Updates an existing table using a schema file at `/blueprint/<schema-name>.js`. Define only the changes you want to apply inside this file.

```bash
kalva update-blueprint <schema-name>
```

```js
// MySQL
await Schema.table("users", (t) => {

    // Add new columns
    t.string("phone", 20).nullable().after("email");
    t.boolean("verified").default(0);

    // Modify existing column
    t.modify("name").string(null, 200).notNullable();

    // Add indexes
    t.addIndex("phone");
    t.addUniqueIndex(["email", "username"]);

    // Add foreign key
    t.addForeign("role_id", "roles", "id", "CASCADE", "CASCADE");

    // Drop column
    t.dropColumn("old_field");

    // Rename column
    t.renameColumn("bio", "about");

});
```

---

## Database Drivers

- [MySQL](#mysql)
- [MongoDB](#mongodb)
- [PostgreSQL](#postgresql)
- [SQLite](#sqlite)

---

## MySQL

### 1. Schema Builder

#### Columns

| Function | Description |
|----------|-------------|
| `t.bit(name, length)` | BIT column with fixed length |
| `t.tinyInteger(name)` | TINYINT column |
| `t.boolean(name)` | BOOLEAN column |
| `t.smallInteger(name)` | SMALLINT column |
| `t.mediumInteger(name)` | MEDIUMINT column |
| `t.integer(name)` | INT column |
| `t.int(name)` | Alias of integer |
| `t.bigInteger(name)` | BIGINT column |
| `t.decimal(name, precision, scale)` | DECIMAL column |
| `t.numeric(name, precision, scale)` | Same as decimal |
| `t.float(name, precision)` | FLOAT column |
| `t.double(name, precision, scale)` | DOUBLE column |
| `t.real(name)` | REAL column |
| `t.date(name)` | DATE column |
| `t.datetime(name, fsp)` | DATETIME column |
| `t.timestamp(name, fsp)` | TIMESTAMP column |
| `t.time(name, fsp)` | TIME column |
| `t.year(name)` | YEAR column |
| `t.char(name, length)` | CHAR column |
| `t.string(name, length)` | STRING column |
| `t.varchar(name, length)` | VARCHAR column |
| `t.tinyText(name)` | TINYTEXT column |
| `t.text(name)` | TEXT column |
| `t.mediumText(name)` | MEDIUMTEXT column |
| `t.longText(name)` | LONGTEXT column |
| `t.binary(name, length)` | BINARY column |
| `t.varBinary(name, length)` | VARBINARY column |
| `t.tinyBlob(name)` | TINYBLOB column |
| `t.blob(name)` | BLOB column |
| `t.mediumBlob(name)` | MEDIUMBLOB column |
| `t.longBlob(name)` | LONGBLOB column |
| `t.json(name)` | JSON column |
| `t.geometry(name)` | GEOMETRY column |
| `t.point(name)` | POINT column |
| `t.lineString(name)` | LINESTRING column |
| `t.polygon(name)` | POLYGON column |
| `t.multiPoint(name)` | MULTIPOINT column |
| `t.multiLineString(name)` | MULTILINESTRING column |
| `t.multiPolygon(name)` | MULTIPOLYGON column |
| `t.geometryCollection(name)` | GEOMETRYCOLLECTION column |
| `t.enum(name, ...values)` | ENUM column |
| `t.timestamps()` | Adds `created_at` and `updated_at` |

---

#### Column Modifiers

| Function | Description |
|----------|-------------|
| `.nullable()` | Allow NULL values |
| `.notNullable()` | Disallow NULL values |
| `.default(value)` | Set default value |
| `.unique()` | Add UNIQUE constraint |
| `.primary()` | Set as PRIMARY KEY |
| `.unsigned()` | Set UNSIGNED |
| `.autoIncrement()` | Enable auto increment |
| `.zerofill()` | Enable ZEROFILL |
| `.invisible()` | Make column invisible |
| `.charset(value)` | Set charset |
| `.collate(value)` | Set collation |
| `.comment(value)` | Add column comment |
| `.check(expression)` | Add CHECK constraint |
| `.after(columnName)` | Place column after another |
| `.generatedAs(expression, stored)` | Create generated column |
| `.references(table, column, onDelete, onUpdate)` | Add foreign key reference |

---

#### Modifying Columns

| Function | Description |
|----------|-------------|
| `t.modify("column").string(null, 200).notNullable().unique()` | Modify column type and constraints |
| `t.modify("age").integer().unsigned()` | Modify integer column |
| `t.modify("price").decimal(null, 10, 2).default(0)` | Modify decimal column |

---

#### Dropping & Renaming Columns

| Function | Description |
|----------|-------------|
| `t.dropColumn("column")` | Drop a column |
| `t.renameColumn("old", "new")` | Rename a column |

---

#### Indexes

| Function | Description |
|----------|-------------|
| `t.addIndex(columns, indexName)` | Add index |
| `t.addUniqueIndex(columns, indexName)` | Add unique index |
| `t.addFullText(columns, indexName)` | Add fulltext index |
| `t.dropIndex(indexName)` | Drop index |
| `t.dropPrimary()` | Drop primary key |

---

#### Foreign Keys

| Function | Description |
|----------|-------------|
| `t.addForeign(column, table, foreignColumn, onDelete, onUpdate)` | Add foreign key |
| `t.dropForeign(constraintName)` | Drop foreign key |

---

#### Example

```js
await Schema.table("users", (t) => {

    t.string("phone", 20).nullable().after("email");
    t.boolean("verified").default(0);

    t.modify("name").string(null, 200).notNullable();

    t.addIndex("phone");
    t.addUniqueIndex(["email", "username"]);

    t.addForeign("role_id", "roles", "id", "CASCADE", "CASCADE");

    t.dropColumn("old_field");

    t.renameColumn("bio", "about");

});
```

---

### 2. ORM & Query Builder

- [Model Setup](#model-setup)
- [Select](#select)
- [Where Clauses](#where-clauses)
- [Joins](#joins)
- [Order, Group & Having](#order-group--having)
- [Limit & Offset](#limit--offset)
- [Fetch Methods](#fetch-methods)
- [Pluck](#pluck)
- [KeyBy](#keyby)
- [Chunk](#chunk)
- [Paginate](#paginate)
- [Aggregates](#aggregates)
- [Creating Records](#creating-records)
- [Updating Records](#updating-records)
- [Deleting Records](#deleting-records)
- [Instance Methods](#instance-methods)
- [Eager Loading](#eager-loading)
- [Relations](#relations)
- [Scopes](#scopes)
- [Raw Queries](#raw-queries)
- [Migrations & Seeding](#migrations--seeding)
- [Chaining Examples](#chaining-examples)

---

#### Model Setup

```js
const { Model } = require('./Model');

class User extends Model {
    static table      = 'users';
    static primaryKey = 'id';
    static fillable   = ['name', 'email', 'role', 'active'];
    static guarded    = ['password'];

    // Relations
    async posts()   { return this.hasMany(Post,    'user_id'); }
    async profile() { return this.hasOne(Profile,  'user_id'); }
    async roles()   { return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id'); }

    // Local scopes
    static scopes = {
        active:  (qb)    => qb.where('active', 1),
        role:    (qb, r) => qb.where('role', r),
        recent:  (qb, n) => qb.orderByDesc('created_at').limit(n),
    };
}
```

---

#### Select

```js
// All columns (default)
User.get();

// Specific columns
User.select('id', 'name', 'email').get();

// Raw expression
User.select('id', 'COUNT(*) as total').get();

// DISTINCT
User.select('city').distinct().get();
```

---

#### Where Clauses

```js
// WHERE col = value
User.where('active', true).get();
User.where('role', 'admin').first();

// WHERE col <op> value
User.whereOp('age', '>=', 18).get();
User.whereOp('score', '<', 50).get();
User.whereOp('name', 'LIKE', 'Mo%').get();
User.whereOp('created_at', '>', '2024-01-01').get();

// OR WHERE
User.where('role', 'admin').orWhere('role', 'moderator').get();

// OR WHERE with operator
User.where('score', '>', 90).orWhereOp('vip', '=', 1).get();

// AND WHERE (alias for where)
User.where('active', 1).andWhere('verified', 1).get();

// WHERE IN
User.whereIn('id', [1, 2, 3]).get();
User.whereIn('status', ['active', 'pending']).get();

// WHERE NOT IN
User.whereNotIn('status', ['banned', 'deleted']).get();

// WHERE IS NULL
User.whereNull('deleted_at').get();

// WHERE IS NOT NULL
User.whereNotNull('email_verified_at').get();

// WHERE BETWEEN
User.whereBetween('age', 18, 30).get();
Order.whereBetween('total', 100, 500).get();

// WHERE NOT BETWEEN
Product.whereNotBetween('price', 10, 50).get();

// WHERE LIKE
User.whereLike('name', 'Mo%').get();
User.whereLike('email', '%@gmail.com').get();

// WHERE ILIKE (case-insensitive)
User.whereILike('name', '%ali%').get();

// WHERE RAW (use ? placeholders)
User.whereRaw('YEAR(created_at) = ?', [2024]).get();
User.whereRaw('JSON_CONTAINS(tags, ?)', ['"vip"']).get();
User.whereRaw('(role = ? OR level > ?)', ['admin', 5]).get();

// Chaining multiple WHERE clauses
User
    .where('active', 1)
    .whereNotNull('email_verified_at')
    .whereBetween('age', 18, 65)
    .whereIn('role', ['admin', 'editor'])
    .orderBy('name')
    .get();
```

---

#### Joins

```js
// INNER JOIN (default)
User.join('posts', 'id', '=', 'user_id').get();

// INNER JOIN (explicit)
User.innerJoin('orders', 'id', '=', 'user_id').get();

// LEFT JOIN
User.leftJoin('profiles', 'id', '=', 'user_id').get();

// RIGHT JOIN
User.rightJoin('orders', 'id', '=', 'user_id').get();

// OUTER / FULL JOIN
User.outerJoin('logs', 'id', '=', 'user_id').get();
User.fullJoin('activity', 'id', '=', 'user_id').get();

// RAW JOIN (for complex ON conditions)
User.joinRaw('INNER JOIN roles ON users.role_id = roles.id AND roles.active = 1').get();

// Multiple joins
User
    .select('users.id', 'users.name', 'orders.total', 'profiles.avatar')
    .leftJoin('orders',   'id', '=', 'user_id')
    .leftJoin('profiles', 'id', '=', 'user_id')
    .where('users.active', 1)
    .get();
```

---

#### Order, Group & Having

```js
// ORDER BY ASC (default)
User.orderBy('name').get();

// ORDER BY with direction
User.orderBy('created_at', 'DESC').get();

// ORDER BY DESC shorthand
Post.orderByDesc('published_at').get();

// RAW ORDER BY
User.orderByRaw('FIELD(status, "active", "pending", "banned")').get();

// GROUP BY
Order
    .select('user_id', 'SUM(total) as revenue')
    .groupBy('user_id')
    .get();

// GROUP BY RAW
Order.groupByRaw('YEAR(created_at)').get();

// HAVING
Order
    .select('user_id', 'SUM(total) as revenue')
    .groupBy('user_id')
    .having('SUM(total) > ?', [1000])
    .get();

// Group + Having + Order combined
Order
    .select('user_id', 'COUNT(*) as order_count', 'SUM(total) as revenue')
    .groupBy('user_id')
    .having('COUNT(*) >= ?', [5])
    .orderByRaw('revenue DESC')
    .limit(10)
    .get();
```

---

#### Limit & Offset

```js
// LIMIT
User.limit(10).get();

// LIMIT + OFFSET
User.limit(10).offset(20).get();

// Manual pagination
const page    = 3;
const perPage = 15;
User.limit(perPage).offset((page - 1) * perPage).get();
```

---

#### Fetch Methods

```js
// Get all matching rows as model instances
const users = await User.where('active', 1).get();

// Get first matching row (or null)
const user = await User.where('email', 'a@b.com').first();

// Get last row by primary key
const latest = await Post.last();

// Get all rows (no conditions)
const all = await User.all();

// Find by primary key
const user = await User.find(5);

// Find by primary key (alias)
const user = await User.findById(5);

// Find by primary key — throws if not found
const user = await User.findOrFail(5);

// Find by any column
const user = await User.findBy('email', 'a@b.com');

// Find first matching conditions object
const user = await User.findOne({ email: 'a@b.com', active: 1 });

// Find all rows matching a column/value pair
const posts = await Post.findAll('user_id', 3);
```

---

#### Pluck

Returns a flat array of a single column's values.

```js
const emails = await User.where('active', 1).pluck('email');
// => ['a@b.com', 'c@d.com', ...]

const ids = await Post.where('user_id', 3).pluck('id');
// => [1, 4, 7, ...]
```

---

#### KeyBy

Returns an object indexed by a column's value.

```js
const userMap = await User.keyBy('id');
// => { 1: User{...}, 2: User{...}, ... }

const byEmail = await User.where('active', 1).keyBy('email');
// => { 'a@b.com': User{...}, ... }
```

---

#### Chunk

Processes large datasets in batches without loading everything into memory.

```js
await User.where('active', 1).chunk(100, async (rows) => {
    for (const user of rows) {
        await sendWelcomeEmail(user);
    }
});
```

---

#### Paginate

Returns paginated data with metadata.

```js
const result = await User.where('active', 1).orderBy('name').paginate(1, 15);
/*
{
    data:         User[],
    total:        120,
    per_page:     15,
    current_page: 1,
    last_page:    8,
    from:         1,
    to:           15
}
*/

// Page 2
const page2 = await User.paginate(2, 15);
```

---

#### Aggregates

```js
// COUNT
const total  = await User.count();
const active = await User.where('active', 1).count();
const byCol  = await User.count('email');        // COUNT(`email`)

// SUM
const revenue = await Order.where('status', 'paid').sum('total');

// AVG
const avgPrice = await Product.avg('price');

// MIN
const cheapest = await Product.min('price');

// MAX
const priciest = await Product.max('price');

// EXISTS
const taken = await User.where('email', 'a@b.com').exists();
// => true | false

// DOESN'T EXIST
const free = await User.where('email', 'a@b.com').doesntExist();
// => true | false
```

---

#### Creating Records

```js
// CREATE — insert and return hydrated instance
const user = await User.create({ name: 'Ali', email: 'a@b.com', active: 1 });
console.log(user.id); // auto-generated id

// CREATE OR IGNORE — returns null on duplicate key conflict
const user = await User.createOrIgnore({ email: 'a@b.com', name: 'Ali' });
if (!user) console.log('Email already taken');

// CREATE MANY — bulk insert, returns array of instances
const users = await User.createMany([
    { name: 'Ali',  email: 'ali@b.com'  },
    { name: 'Sara', email: 'sara@b.com' },
]);

// FIRST OR CREATE — find or create
const user = await User.firstOrCreate(
    { email: 'a@b.com' },           // lookup conditions
    { name: 'Ali', active: 1 }      // extra data if creating
);

// UPDATE OR CREATE (upsert) — uses ON DUPLICATE KEY UPDATE
const user = await User.updateOrCreate(
    { email: 'a@b.com' },           // match conditions
    { name: 'Ali', active: 1 }      // values to set on update
);

// INSERT (raw) — no hydration, returns raw DB result
const result = await User.insert({ name: 'Ali', email: 'a@b.com' });
console.log(result.data.insertId);

// INSERT MANY (raw bulk)
await User.insertMany([
    { name: 'A', email: 'a@b.com' },
    { name: 'B', email: 'b@c.com' },
]);
```

---

#### Updating Records

**Static methods**

```js
// UPDATE by primary key — returns updated instance
const user = await User.update(5, { name: 'New Name', active: 0 });

// UPDATE MANY — array of [id, data] pairs
await User.updateMany([
    [1, { name: 'Ali'  }],
    [2, { name: 'Sara' }],
    [3, { active: 0    }],
]);

// UPDATE WHERE (static) — update rows matching conditions object
await User.updateWhere({ active: 0 }, { deleted: 1 });
await User.updateWhere({ role: 'guest' }, { role: 'user' });

// INCREMENT (via QueryBuilder)
await User.where('id', 5).increment('login_count');
await Post.where('id', 1).increment('views', 5);

// DECREMENT (via QueryBuilder)
await User.where('id', 5).decrement('credits', 10);
```

**QueryBuilder method**

```js
// Chain conditions then call updateWhere(data)
await User
    .whereOp('last_login', '<', '2023-01-01')
    .where('active', 1)
    .updateWhere({ active: 0 });

await Post
    .whereIn('status', ['draft', 'hidden'])
    .whereNull('published_at')
    .updateWhere({ archived: 1 });
```

**Instance methods**

```js
// update() on an existing instance
const user = await User.find(5);
await user.update({ name: 'Updated Name', email: 'new@email.com' });

// Modify directly then save()
const user = await User.find(5);
user.name   = 'New Name';
user.active = 0;
await user.save();

// increment / decrement on instance
const user = await User.find(5);
await user.increment('points', 50);
await user.decrement('credits', 10);
console.log(user.points);  // updated in-memory too
```

---

#### Deleting Records

**Static methods**

```js
// DELETE by primary key
await User.delete(5);

// DELETE by primary key (alias)
await User.destroy(5);

// DELETE MANY by primary keys
await User.deleteMany([1, 2, 3]);

// DELETE WHERE (static) — conditions object
await User.deleteWhere({ active: 0, verified: 0 });

// TRUNCATE — drops all rows instantly
await User.truncate();
```

**QueryBuilder method**

```js
// Chain conditions then call deleteWhere()
await User
    .whereOp('created_at', '<', '2020-01-01')
    .whereNull('email_verified_at')
    .deleteWhere();

await Post
    .where('status', 'spam')
    .whereOp('reports', '>', 5)
    .deleteWhere();
```

**Instance method**

```js
const user = await User.find(5);
await user.delete();
console.log(user._exists); // false
```

---

#### Instance Methods

```js
// SAVE — INSERT if new, UPDATE if existing
const user = new User();
user.name  = 'Ali';
user.email = 'a@b.com';
await user.save();   // INSERT — sets user.id

user.name = 'Updated';
await user.save();   // UPDATE

// REFRESH / RELOAD — re-fetch from DB
const user = await User.find(5);
await user.refresh();  // syncs to latest DB state
await user.reload();   // alias for refresh()

// TO JSON — plain object (strips _ internal properties)
const user = await User.find(5);
const obj  = user.toJSON();
res.json(obj);

// TO ARRAY — array of [key, value] pairs
const user  = await User.find(5);
const pairs = user.toArray();
// => [['id', 1], ['name', 'Ali'], ['email', 'a@b.com'], ...]
```

---

#### Eager Loading

```js
class User extends Model {
    async posts()   { return this.hasMany(Post,    'user_id'); }
    async profile() { return this.hasOne(Profile,  'user_id'); }
}

// Load one relation
const users = await User.with('posts').get();
console.log(users[0].posts); // Post[]

// Load multiple relations
const users = await User.with('posts', 'profile').get();

// Load relation count
const users = await User.withCount('posts').get();
console.log(users[0].posts_count); // number

// Count multiple relations
const users = await User.withCount('posts', 'orders').get();

// Eager load on an existing instance
const user = await User.find(5);
await user.eagerLoad('posts');
console.log(user.posts);

// Lazy load (alias for eagerLoad)
await user.lazyLoad('profile');
console.log(user.profile);
```

---

#### Relations

##### belongsTo

This model has a FK pointing to a parent.

```js
class Post extends Model {
    static table    = 'posts';
    static fillable = ['title', 'body', 'user_id'];

    async user() {
        return this.belongsTo(User, 'user_id', 'id');
    }
}

const post = await Post.find(1);
const user = await post.user();
```

##### hasOne

The related table has a FK pointing to this model.

```js
class User extends Model {
    async profile() {
        return this.hasOne(Profile, 'user_id', 'id');
    }
}

const user    = await User.find(1);
const profile = await user.profile();
```

##### hasMany

```js
class User extends Model {
    async posts() {
        return this.hasMany(Post, 'user_id', 'id');
    }

    async orders() {
        return this.hasMany(Order, 'user_id');
    }
}

const user  = await User.find(1);
const posts = await user.posts();
```

##### belongsToMany

Many-to-many via a pivot table.

```js
class User extends Model {
    async roles() {
        return this.belongsToMany(
            Role,           // related model
            'user_roles',   // pivot table
            'user_id',      // FK for this model in pivot
            'role_id'       // FK for related model in pivot
        );
    }

    async tags() {
        return this.belongsToMany(Tag, 'post_tags', 'user_id', 'tag_id');
    }
}

const user  = await User.find(1);
const roles = await user.roles();
```

##### attach

Adds pivot rows using INSERT IGNORE.

```js
const user = await User.find(1);

// Attach role IDs
await user.attach('user_roles', 'user_id', 'role_id', [2, 3]);

// Attach with extra pivot data
await user.attach(
    'user_roles',
    'user_id',
    'role_id',
    [2, 3],
    [{ assigned_at: new Date() }, { assigned_at: new Date() }]
);
```

##### detach

Removes pivot rows.

```js
const user = await User.find(1);

// Detach specific IDs
await user.detach('user_roles', 'user_id', 'role_id', [2, 3]);

// Detach all (omit ids)
await user.detach('user_roles', 'user_id', 'role_id');
```

##### sync

Replaces all pivot rows (detaches all existing, then attaches given IDs).

```js
const user = await User.find(1);

await user.sync('user_roles', 'user_id', 'role_id', [1, 4, 5]);

// With extra pivot data
await user.sync(
    'user_roles', 'user_id', 'role_id',
    [1, 4],
    [{ level: 1 }, { level: 2 }]
);
```

---

#### Scopes

##### Local Scopes

```js
class User extends Model {
    static scopes = {
        active:   (qb)       => qb.where('active', 1),
        verified: (qb)       => qb.whereNotNull('email_verified_at'),
        role:     (qb, role) => qb.where('role', role),
        recent:   (qb, n)    => qb.orderByDesc('created_at').limit(n),
    };
}

// Apply a scope
const users  = await User.scope('active').get();
const admins = await User.scope('role', 'admin').get();
const recent = await User.scope('recent', 5).get();

// Scopes return a QueryBuilder — keep chaining
const admins = await User
    .scope('active')
    .where('country', 'EG')
    .orderBy('name')
    .get();
```

##### Global Scopes

Applied automatically to every query on the model.

```js
// Soft-delete filter
User.globalScope('notDeleted', qb => qb.whereNull('deleted_at'));

// Multi-tenant filter
User.globalScope('tenant', qb => qb.where('tenant_id', getCurrentTenantId()));

// All queries are now filtered automatically:
const users = await User.all();
// => SELECT * FROM `users` WHERE `users`.`deleted_at` IS NULL
```

---

#### Raw Queries

```js
// Static raw — executes directly on the DB
const result = await User.raw(
    'SELECT * FROM users WHERE MATCH(bio) AGAINST(?)',
    ['search term']
);
console.log(result.data);

// Alias: query()
const result = await User.query(
    'UPDATE users SET score = score * 1.1 WHERE role = ?',
    ['premium']
);

// QueryBuilder raw — useful inside a chain
const qb = User._qb();
await qb.raw('CALL recalculate_scores(?)', [2024]);

// Maintenance
await User.raw('OPTIMIZE TABLE users');
await User.raw('ANALYZE TABLE users');
```

---

#### Migrations & Seeding

```js
class User extends Model {
    static async migrate() {
        return Schema.create('users', (t) => {
            t.increments('id');
            t.string('name');
            t.string('email').unique();
            t.boolean('active').default(true);
            t.timestamp('deleted_at').nullable();
            t.timestamps();
        });
    }
}

// Run migration
await User.migrate();

// Rollback — drops the table
await User.rollbackMigration();

// Rollback with FK checks disabled
await User.rollbackMigration(true);

// Seed — safe to re-run (uses INSERT IGNORE)
const result = await User.seed([
    { id: 1, name: 'Admin', email: 'admin@app.com', role: 'admin'  },
    { id: 2, name: 'Guest', email: 'guest@app.com', role: 'user'   },
    { id: 3, name: 'Bot',   email: 'bot@app.com',   role: 'system' },
]);
console.log(result.message);
// => "✔ Seeded 3 rows. 0 skipped (conflict)."

// Re-running safely skips existing rows
await User.seed([{ id: 1, name: 'Admin', email: 'admin@app.com', role: 'admin' }]);
// => "✔ Seeded 0 rows. 1 skipped (conflict)."
```

---

#### Chaining Examples

```js
// Complex query — chain everything together
const result = await User
    .select('id', 'name', 'email')
    .where('active', 1)
    .whereNotNull('email_verified_at')
    .whereIn('role', ['admin', 'editor'])
    .whereBetween('age', 18, 65)
    .leftJoin('profiles', 'id', '=', 'user_id')
    .orderBy('name')
    .limit(20)
    .offset(0)
    .get();

// Aggregate with conditions
const stats = {
    total:    await User.count(),
    active:   await User.where('active', 1).count(),
    revenue:  await Order.where('status', 'paid').sum('total'),
    avgOrder: await Order.avg('total'),
};

// Paginated admin list
const page = await User
    .scope('active')
    .where('role', 'admin')
    .orderByDesc('created_at')
    .paginate(1, 25);

// Batch process all users in chunks
await User.where('active', 1).chunk(500, async (batch) => {
    await Promise.all(batch.map(u => syncToExternalService(u)));
});
```

---

> Read more in the MySQL documentation for Kalva:
> - [Database Doc](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-database-documentation.md)
> - [Blueprint Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-schema-documentation.md)
> - [ORM & Query Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-orm-documentation.md)

---

## MongoDB

> Documentation coming soon.

---

## PostgreSQL

> Documentation coming soon.

---

## SQLite

> Documentation coming soon.

---

## Help

Run this command to view all available Kalva CLI commands.

```bash
kalva --help
```