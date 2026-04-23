'use strict';

/**
 * ════════════════════════════════════════════════════════════════════
 *  PgModel ORM — Usage Guide & Cheatsheet
 *  Requires: pg-model.js  +  database.js  +  pg-schema.js
 * ════════════════════════════════════════════════════════════════════
 */

const { PgModel } = require('./pg-model');
const { Schema }  = require('./schema');   // your existing pg schema file

// ─────────────────────────────────────────────────────────────────────────────
//  1.  DEFINE A MODEL
// ─────────────────────────────────────────────────────────────────────────────

class User extends PgModel {
    static table      = 'users';
    static schema     = 'public';      // optional — default is 'public'
    static primaryKey = 'id';
    static fillable   = ['name', 'email', 'age', 'active'];

    // ── Local scopes ─────────────────────────────────────────────────────────
    static scopes = {
        active: (qb)         => qb.where('active', true),
        adults: (qb)         => qb.whereOp('age', '>=', 18),
        older:  (qb, minAge) => qb.whereOp('age', '>=', minAge),
    };

    // ── Relations ─────────────────────────────────────────────────────────────
    async posts()   { return this.hasMany(Post,    'user_id'); }
    async profile() { return this.hasOne(Profile,  'user_id'); }
    async roles()   { return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id'); }

    // ── Migrate (optional convenience) ────────────────────────────────────────
    static async migrate() {
        return Schema.create('users', (t) => {
            t.bigIncrements('id');
            t.string('name', 150).notNullable();
            t.string('email').unique().notNullable();
            t.integer('age').nullable();
            t.boolean('active').default(true);
            t.timestamps();
        });
    }
}

class Post extends PgModel {
    static table    = 'posts';
    static fillable = ['title', 'body', 'user_id'];

    async author() { return this.belongsTo(User, 'user_id'); }
}

class Profile extends PgModel { static table = 'profiles'; }
class Role    extends PgModel { static table = 'roles'; }

// ─────────────────────────────────────────────────────────────────────────────
//  2.  GLOBAL SCOPES  (auto-applied to every query on the model)
// ─────────────────────────────────────────────────────────────────────────────

User.globalScope('notDeleted', qb => qb.whereNull('deleted_at'));

// ─────────────────────────────────────────────────────────────────────────────
//  3.  CREATE / INSERT
// ─────────────────────────────────────────────────────────────────────────────

(async () => {

// create — INSERT … RETURNING * + returns hydrated PgModel instance
const user = await User.create({ name: 'Alice', email: 'alice@ex.com', age: 30, active: true });

// createMany — INSERT multiple, returns PgModel[]
const users = await User.createMany([
    { name: 'Bob',   email: 'bob@ex.com',   age: 25 },
    { name: 'Carol', email: 'carol@ex.com', age: 22 },
]);

// createOrIgnore — INSERT … ON CONFLICT DO NOTHING, returns null on conflict
await User.createOrIgnore({ email: 'alice@ex.com', name: 'Alice' });

// firstOrCreate — find or insert
const admin = await User.firstOrCreate({ email: 'admin@ex.com' }, { name: 'Admin', active: true });

// updateOrCreate — INSERT … ON CONFLICT (cols) DO UPDATE SET … RETURNING *
const upserted = await User.updateOrCreate({ email: 'bob@ex.com' }, { name: 'Bobby', age: 26 });

// Low-level insert — returns raw { is_error, data: rows[] } (data[0] = inserted row)
await User.insert({ name: 'Dave', email: 'd@ex.com', age: 40 });

// Low-level insertMany
await User.insertMany([{ name: 'Eve', email: 'e@ex.com', age: 28 }]);

// ─────────────────────────────────────────────────────────────────────────────
//  4.  FIND / READ
// ─────────────────────────────────────────────────────────────────────────────

await User.find(1);                         // by PK, null if missing
await User.findById(1);                     // alias for find
await User.findOrFail(1);                   // throws if missing
await User.findBy('email', 'a@ex.com');     // first match by col/value
await User.findOne({ name: 'Alice' });      // first match by conditions object
await User.findAll('active', true);         // all where active = true
await User.all();                           // every row
await User.first();                         // first row
await User.last();                          // last row (by PK desc)
await User.get();                           // alias for all()

// ─────────────────────────────────────────────────────────────────────────────
//  5.  WHERE CLAUSES
// ─────────────────────────────────────────────────────────────────────────────

await User.where('active', true).get();
await User.whereOp('age', '>=', 18).get();
await User.whereOp('age', '!=', 0).get();
await User.whereOp('name', 'ILIKE', 'al%').get();   // native PG ILIKE via whereOp
await User.orWhere('name', 'Bob').get();
await User.orWhereOp('age', '<', 10).get();
await User.andWhere('active', true).get();
await User.whereIn('id', [1, 2, 3]).get();
await User.whereNotIn('id', [4, 5]).get();
await User.whereNull('deleted_at').get();
await User.whereNotNull('email').get();
await User.whereBetween('age', 18, 65).get();
await User.whereNotBetween('age', 0, 17).get();
await User.whereLike('name', 'Al%').get();           // LIKE (case-sensitive)
await User.whereILike('name', 'al%').get();          // ILIKE (case-insensitive, PG native)

// Raw WHERE — use ? placeholders (auto-converted to $N)
await User.whereRaw('"age" > ? AND "active" = ?', [18, true]).get();

// Chaining
await User
    .where('active', true)
    .whereOp('age', '>=', 18)
    .whereILike('name', 'a%')
    .get();

// ─────────────────────────────────────────────────────────────────────────────
//  6.  SELECT / DISTINCT / PLUCK / KEY-BY / CHUNK
// ─────────────────────────────────────────────────────────────────────────────

await User.select('id', 'name', 'email').get();
await User.select('id', 'name', 'COUNT(*) as post_count').groupBy('id').get();
await User.distinct().pluck('name');                     // unique names
await User.where('active', true).pluck('email');         // array of emails
await User.keyBy('id');                                  // { 1: User, 2: User, … }

await User.where('active', true).chunk(100, async (batch) => {
    for (const u of batch) console.log(u.name);
});

// ─────────────────────────────────────────────────────────────────────────────
//  7.  PAGINATE
// ─────────────────────────────────────────────────────────────────────────────

const page = await User.where('active', true).orderBy('name').paginate(1, 20);
// {
//   data: PgModel[],
//   total: 100,
//   per_page: 20,
//   current_page: 1,
//   last_page: 5,
//   from: 1,
//   to: 20,
// }

// ─────────────────────────────────────────────────────────────────────────────
//  8.  ORDER / GROUP / HAVING / LIMIT / OFFSET
// ─────────────────────────────────────────────────────────────────────────────

await User.orderBy('name').get();
await User.orderByDesc('created_at').limit(5).get();
await User.orderByRaw('"age" * 2 DESC NULLS LAST').get();
await User.groupBy('active').select('active', 'COUNT(*) as total').get();
await User.groupByRaw('"active", "age"').get();
await User.groupBy('active').having('COUNT(*) > ?', [1]).get();
await User.limit(10).offset(20).get();

// ─────────────────────────────────────────────────────────────────────────────
//  9.  JOINS  (PostgreSQL supports RIGHT JOIN and FULL OUTER JOIN natively)
// ─────────────────────────────────────────────────────────────────────────────

await User.join('posts', 'id', '=', 'user_id').get();
await User.leftJoin('profiles', 'id', '=', 'user_id').select('name', 'bio').get();
await User.rightJoin('orders', 'id', '=', 'user_id').get();
await User.fullJoin('subscriptions', 'id', '=', 'user_id').get();
await User.innerJoin('roles_users', 'id', '=', 'user_id').get();
await User.joinRaw('LEFT JOIN "profiles" ON "users"."id" = "profiles"."user_id"').get();

// ─────────────────────────────────────────────────────────────────────────────
//  10.  AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

await User.count();                           // total rows
await User.where('active', true).count();     // filtered count
await User.count('email');                    // count where email IS NOT NULL
await User.sum('age');
await User.avg('age');
await User.min('age');
await User.max('age');
await User.where('active', true).exists();    // true / false
await User.where('active', false).doesntExist();

// ─────────────────────────────────────────────────────────────────────────────
//  11.  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

await User.update(1, { name: 'Alice B.' });   // returns updated PgModel instance
await User.updateMany([[1, { active: false }], [2, { active: false }]]);
await User.updateWhere({ active: false }, { deleted_at: new Date() });

// QueryBuilder updateWhere:
await User.where('age', 0).updateWhere({ active: false });

// On an instance:
const u = await User.find(1);
await u.update({ name: 'Alice C.' });    // update + save in one step
await u.save();                          // persist dirty changes

// ─────────────────────────────────────────────────────────────────────────────
//  12.  DELETE
// ─────────────────────────────────────────────────────────────────────────────

await User.delete(1);
await User.deleteMany([1, 2, 3]);
await User.deleteWhere({ active: false });
await User.destroy(5);                       // alias for delete
await User.truncate();                       // TRUNCATE TABLE … RESTART IDENTITY CASCADE

// On an instance:
const u2 = await User.find(2);
await u2.delete();

// ─────────────────────────────────────────────────────────────────────────────
//  13.  INCREMENT / DECREMENT
// ─────────────────────────────────────────────────────────────────────────────

await User.where('id', 1).increment('age');          // +1
await User.where('id', 1).increment('age', 5);       // +5
await User.where('id', 1).decrement('age', 2);       // -2

// On an instance:
const u3 = await User.find(3);
await u3.increment('age');
await u3.decrement('age', 3);

// ─────────────────────────────────────────────────────────────────────────────
//  14.  REFRESH / RELOAD
// ─────────────────────────────────────────────────────────────────────────────

const u4 = await User.find(1);
await u4.refresh();
await u4.reload();   // alias

// ─────────────────────────────────────────────────────────────────────────────
//  15.  SCOPES
// ─────────────────────────────────────────────────────────────────────────────

await User.scope('active').get();
await User.scope('adults').orderBy('name').get();
await User.scope('older', 21).get();   // passes extra arg to scope fn

// ─────────────────────────────────────────────────────────────────────────────
//  16.  RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

const u5 = await User.find(1);

const posts   = await u5.hasMany(Post, 'user_id');
const profile = await u5.hasOne(Profile, 'user_id');
const post    = await Post.find(1);
const author  = await post.belongsTo(User, 'user_id');

// Many-to-many (pivot table)
const roles   = await u5.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');

// Named relation methods:
const myPosts = await u5.posts();

// ─────────────────────────────────────────────────────────────────────────────
//  17.  PIVOT: ATTACH / DETACH / SYNC
// ─────────────────────────────────────────────────────────────────────────────

// INSERT … ON CONFLICT DO NOTHING (no duplicates)
await u5.attach('user_roles', 'user_id', 'role_id', [1, 2, 3]);

// Delete specific pivot rows
await u5.detach('user_roles', 'user_id', 'role_id', [3]);

// Delete all pivot rows for this user
await u5.detach('user_roles', 'user_id', 'role_id');

// Detach all, then attach — atomic replace
await u5.sync('user_roles', 'user_id', 'role_id', [1, 2]);

// attach with extra pivot data:
await u5.attach('user_roles', 'user_id', 'role_id', [1, 2], [
    { granted_at: new Date() },
    { granted_at: new Date() },
]);

// ─────────────────────────────────────────────────────────────────────────────
//  18.  EAGER LOAD / LAZY LOAD / WITH
// ─────────────────────────────────────────────────────────────────────────────

await u5.eagerLoad('posts');     // u5.posts is now populated
await u5.lazyLoad('profile');    // alias

// Via QueryBuilder:
const usersWithPosts  = await User.with('posts').get();
const usersWithCounts = await User.withCount('posts').get();
// → each user has posts_count property

// ─────────────────────────────────────────────────────────────────────────────
//  19.  SERIALIZE
// ─────────────────────────────────────────────────────────────────────────────

const u6 = await User.find(1);
console.log(u6.toJSON());    // plain object, no _ internals
console.log(u6.toArray());   // [['id', 1], ['name', 'Alice'], …]

// ─────────────────────────────────────────────────────────────────────────────
//  20.  RAW SQL  (positional $1, $2, … params)
// ─────────────────────────────────────────────────────────────────────────────

await User.raw('SELECT * FROM users WHERE age > $1', [18]);
await User.query('UPDATE users SET active = $1 WHERE id = $2', [true, 1]);

// ─────────────────────────────────────────────────────────────────────────────
//  21.  MIGRATE / ROLLBACK / SEED
// ─────────────────────────────────────────────────────────────────────────────

// If you defined migrate() on the model:
await User.migrate();

// Drop the table (with CASCADE):
await User.rollbackMigration(true);

// Seed — uses createOrIgnore, safe to run multiple times
await Role.seed([
    { name: 'admin' },
    { name: 'editor' },
    { name: 'viewer' },
]);

})();

// ─────────────────────────────────────────────────────────────────────────────
//  KEY DIFFERENCES vs SQLite & MongoDB ORMs
// ─────────────────────────────────────────────────────────────────────────────

/*
  Feature                │  SQLite               │  MongoDB              │  PostgreSQL (this)
  ──────────────────────────────────────────────────────────────────────────────────────────────
  Placeholders           │  ?                    │  N/A (Mongoose)       │  $1, $2, … (pg driver)
  createOrIgnore         │  INSERT OR IGNORE      │  11000 catch          │  ON CONFLICT DO NOTHING
  updateOrCreate         │  manual upsert         │  findOneAndUpdate     │  ON CONFLICT DO UPDATE
  INSERT returns id      │  lastID               │  doc._id              │  RETURNING * (full row)
  truncate               │  DELETE FROM           │  deleteMany({})       │  TRUNCATE … RESTART IDENTITY CASCADE
  rightJoin              │  Emulated (LEFT)       │  Emulated ($lookup)   │  Native RIGHT JOIN
  fullJoin               │  Emulated (LEFT)       │  Emulated ($lookup)   │  Native FULL OUTER JOIN
  whereILike             │  LOWER() workaround    │  /regex/i             │  Native ILIKE
  whereRaw               │  Raw SQL fragment      │  Raw Mongo filter     │  Raw SQL, ? → $N auto-rebind
  groupBy aggregate      │  SQL GROUP BY          │  $group pipeline      │  SQL GROUP BY
  migrate()              │  N/A (Schema.create)   │  ensureIndexes()      │  Override → Schema.create()
  rollbackMigration()    │  N/A                   │  dropIndexes()        │  DROP TABLE IF EXISTS
  schema namespace       │  N/A                   │  N/A                  │  static schema = 'analytics'
  pivot attach           │  INSERT OR IGNORE      │  $addToSet            │  ON CONFLICT DO NOTHING
*/