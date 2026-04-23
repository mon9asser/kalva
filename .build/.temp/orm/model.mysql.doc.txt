'use strict';

/**
 * ════════════════════════════════════════════════════════════════════
 *  MySqlModel ORM — Usage Guide & Cheatsheet
 *  Requires: model.js  +  database.js  +  schema.js
 * ════════════════════════════════════════════════════════════════════
 */

const { MySqlModel } = require('./model');
const { Schema }     = require('./schema');   // your existing mysql schema file

// ─────────────────────────────────────────────────────────────────────────────
//  1.  DEFINE A MODEL
// ─────────────────────────────────────────────────────────────────────────────

class User extends MySqlModel {
    static table      = 'users';
    static primaryKey = 'id';
    static fillable   = ['name', 'email', 'age', 'active'];

    // ── Local scopes ─────────────────────────────────────────────────────────
    static scopes = {
        active: (qb)         => qb.where('active', 1),
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
            t.boolean('active').default(1);
            t.timestamps();
        });
    }
}

class Post extends MySqlModel {
    static table    = 'posts';
    static fillable = ['title', 'body', 'user_id'];

    async author() { return this.belongsTo(User, 'user_id'); }
}

class Profile extends MySqlModel { static table = 'profiles'; }
class Role    extends MySqlModel { static table = 'roles'; }

// ─────────────────────────────────────────────────────────────────────────────
//  2.  GLOBAL SCOPES  (auto-applied to every query on the model)
// ─────────────────────────────────────────────────────────────────────────────

User.globalScope('notDeleted', qb => qb.whereNull('deleted_at'));

// ─────────────────────────────────────────────────────────────────────────────
//  3.  CREATE / INSERT
// ─────────────────────────────────────────────────────────────────────────────

(async () => {

// create — INSERT + fetches row via insertId, returns hydrated MySqlModel instance
const user = await User.create({ name: 'Alice', email: 'alice@ex.com', age: 30, active: 1 });

// createMany — INSERT multiple, returns MySqlModel[]
const users = await User.createMany([
    { name: 'Bob',   email: 'bob@ex.com',   age: 25 },
    { name: 'Carol', email: 'carol@ex.com', age: 22 },
]);

// createOrIgnore — INSERT IGNORE, returns null on duplicate key conflict
await User.createOrIgnore({ email: 'alice@ex.com', name: 'Alice' });

// firstOrCreate — find or insert
const admin = await User.firstOrCreate({ email: 'admin@ex.com' }, { name: 'Admin', active: 1 });

// updateOrCreate — INSERT … ON DUPLICATE KEY UPDATE
const upserted = await User.updateOrCreate({ email: 'bob@ex.com' }, { name: 'Bobby', age: 26 });

// Low-level insert — returns raw { is_error, data: { insertId, affectedRows } }
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
await User.findAll('active', 1);            // all where active = 1
await User.all();                           // every row
await User.first();                         // first row
await User.last();                          // last row (by PK desc)
await User.get();                           // alias for all()

// ─────────────────────────────────────────────────────────────────────────────
//  5.  WHERE CLAUSES
// ─────────────────────────────────────────────────────────────────────────────

await User.where('active', 1).get();
await User.whereOp('age', '>=', 18).get();
await User.whereOp('age', '!=', 0).get();
await User.whereOp('name', 'LIKE', 'Al%').get();
await User.orWhere('name', 'Bob').get();
await User.orWhereOp('age', '<', 10).get();
await User.andWhere('active', 1).get();
await User.whereIn('id', [1, 2, 3]).get();
await User.whereNotIn('id', [4, 5]).get();
await User.whereNull('deleted_at').get();
await User.whereNotNull('email').get();
await User.whereBetween('age', 18, 65).get();
await User.whereNotBetween('age', 0, 17).get();
await User.whereLike('name', 'Al%').get();           // LIKE (already case-insensitive in utf8mb4_unicode_ci)
await User.whereILike('name', 'al%').get();          // LOWER() wrap — forces case-insensitive on any collation

// Raw WHERE — use ? placeholders (mysql2 native)
await User.whereRaw('`age` > ? AND `active` = ?', [18, 1]).get();

// Chaining
await User
    .where('active', 1)
    .whereOp('age', '>=', 18)
    .whereILike('name', 'a%')
    .get();

// ─────────────────────────────────────────────────────────────────────────────
//  6.  SELECT / DISTINCT / PLUCK / KEY-BY / CHUNK
// ─────────────────────────────────────────────────────────────────────────────

await User.select('id', 'name', 'email').get();
await User.select('id', 'name', 'COUNT(*) as post_count').groupBy('id').get();
await User.distinct().pluck('name');                     // unique names
await User.where('active', 1).pluck('email');            // array of emails
await User.keyBy('id');                                  // { 1: User, 2: User, … }

await User.where('active', 1).chunk(100, async (batch) => {
    for (const u of batch) console.log(u.name);
});

// ─────────────────────────────────────────────────────────────────────────────
//  7.  PAGINATE
// ─────────────────────────────────────────────────────────────────────────────

const page = await User.where('active', 1).orderBy('name').paginate(1, 20);
// {
//   data: MySqlModel[],
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
await User.orderByRaw('`age` * 2 DESC').get();
await User.groupBy('active').select('active', 'COUNT(*) as total').get();
await User.groupByRaw('`active`, `age`').get();
await User.groupBy('active').having('COUNT(*) > ?', [1]).get();
await User.limit(10).offset(20).get();

// ─────────────────────────────────────────────────────────────────────────────
//  9.  JOINS
//  NOTE: MySQL does not natively support FULL OUTER JOIN.
//        fullJoin / outerJoin are included for API parity — use with caution
//        or emulate with UNION of LEFT + RIGHT joins via joinRaw / raw().
// ─────────────────────────────────────────────────────────────────────────────

await User.join('posts', 'id', '=', 'user_id').get();
await User.leftJoin('profiles', 'id', '=', 'user_id').select('name', 'bio').get();
await User.rightJoin('orders', 'id', '=', 'user_id').get();
await User.innerJoin('roles_users', 'id', '=', 'user_id').get();
await User.joinRaw('LEFT JOIN `profiles` ON `users`.`id` = `profiles`.`user_id`').get();

// Emulating FULL OUTER JOIN in MySQL via raw:
await User.raw(`
    SELECT * FROM \`users\`
    LEFT JOIN \`subscriptions\` ON \`users\`.\`id\` = \`subscriptions\`.\`user_id\`
    UNION
    SELECT * FROM \`users\`
    RIGHT JOIN \`subscriptions\` ON \`users\`.\`id\` = \`subscriptions\`.\`user_id\`
`);

// ─────────────────────────────────────────────────────────────────────────────
//  10.  AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

await User.count();                           // total rows
await User.where('active', 1).count();        // filtered count
await User.count('email');                    // count where email IS NOT NULL
await User.sum('age');
await User.avg('age');
await User.min('age');
await User.max('age');
await User.where('active', 1).exists();       // true / false
await User.where('active', 0).doesntExist();

// ─────────────────────────────────────────────────────────────────────────────
//  11.  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

await User.update(1, { name: 'Alice B.' });   // returns updated MySqlModel instance
await User.updateMany([[1, { active: 0 }], [2, { active: 0 }]]);
await User.updateWhere({ active: 0 }, { deleted_at: new Date() });

// QueryBuilder updateWhere:
await User.where('age', 0).updateWhere({ active: 0 });

// On an instance:
const u = await User.find(1);
await u.update({ name: 'Alice C.' });    // update + save in one step
await u.save();                          // persist dirty changes

// ─────────────────────────────────────────────────────────────────────────────
//  12.  DELETE
// ─────────────────────────────────────────────────────────────────────────────

await User.delete(1);
await User.deleteMany([1, 2, 3]);
await User.deleteWhere({ active: 0 });
await User.destroy(5);                       // alias for delete
await User.truncate();                       // TRUNCATE TABLE (resets AUTO_INCREMENT)

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

// INSERT IGNORE (no duplicates)
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
//  20.  RAW SQL  (positional ? params — mysql2 native)
// ─────────────────────────────────────────────────────────────────────────────

await User.raw('SELECT * FROM `users` WHERE `age` > ?', [18]);
await User.query('UPDATE `users` SET `active` = ? WHERE `id` = ?', [1, 1]);

// ─────────────────────────────────────────────────────────────────────────────
//  21.  MIGRATE / ROLLBACK / SEED
// ─────────────────────────────────────────────────────────────────────────────

// If you defined migrate() on the model:
await User.migrate();

// Drop the table. Pass true to disable FK checks first (MySQL has no CASCADE DROP):
await User.rollbackMigration(true);

// Seed — uses createOrIgnore (INSERT IGNORE), safe to run multiple times
await Role.seed([
    { name: 'admin' },
    { name: 'editor' },
    { name: 'viewer' },
]);

})();

// ─────────────────────────────────────────────────────────────────────────────
//  KEY DIFFERENCES vs PostgreSQL ORM
// ─────────────────────────────────────────────────────────────────────────────

/*
  Feature                │  PostgreSQL                        │  MySQL (this)
  ────────────────────────────────────────────────────────────────────────────────────
  Placeholders           │  $1, $2, … (pg driver)             │  ? (mysql2 driver)
  Identifier quoting     │  "double_quotes"                   │  `backticks`
  createOrIgnore         │  ON CONFLICT DO NOTHING            │  INSERT IGNORE
  updateOrCreate         │  ON CONFLICT DO UPDATE RETURNING * │  ON DUPLICATE KEY UPDATE
  INSERT returns row     │  RETURNING * (full row, 1 query)   │  insertId → find() (2 queries)
  update returns row     │  RETURNING * (full row, 1 query)   │  find() re-fetch (2 queries)
  truncate               │  TRUNCATE … RESTART IDENTITY CASCADE│  TRUNCATE TABLE
  rightJoin              │  Native                            │  Native
  fullJoin / outerJoin   │  Native FULL OUTER JOIN            │  Not supported — emulate with UNION
  whereILike             │  Native ILIKE                      │  LOWER() wrap on both sides
  whereRaw placeholders  │  ? auto-rebound to $N              │  ? used directly (no rebinding)
  rollbackMigration      │  DROP TABLE IF EXISTS … CASCADE    │  SET FK_CHECKS=0 + DROP + SET FK_CHECKS=1
  schema namespace       │  static schema = 'analytics'       │  Not applicable (use DB name in DSN)
  boolean values         │  true / false                      │  1 / 0  (TINYINT(1))
  pivot attach           │  ON CONFLICT DO NOTHING            │  INSERT IGNORE
  migrate()              │  Override → Schema.create()        │  Override → Schema.create()
*/