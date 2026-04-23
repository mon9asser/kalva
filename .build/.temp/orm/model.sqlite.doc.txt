'use strict';

/**
 * ════════════════════════════════════════════════════════════════════
 *  ORM — Usage Guide & Cheatsheet
 *  Requires: model.js  +  database.js  +  schema.js
 * ════════════════════════════════════════════════════════════════════
 */

const { Model } = require('./model');
const { Schema } = require('./schema');

// ─────────────────────────────────────────────────────────────────────────────
//  1.  DEFINE A MODEL
// ─────────────────────────────────────────────────────────────────────────────

class User extends Model {
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

    async posts()    { return this.hasMany(Post, 'user_id'); }
    async profile()  { return this.hasOne(Profile, 'user_id'); }
    async roles()    { return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id'); }
}

class Post extends Model {
    static table    = 'posts';
    static fillable = ['title', 'body', 'user_id'];

    async author() { return this.belongsTo(User, 'user_id'); }
}

class Profile extends Model { static table = 'profiles'; }
class Role    extends Model { static table = 'roles'; }

// ─────────────────────────────────────────────────────────────────────────────
//  2.  GLOBAL SCOPES  (auto-applied to every query on the model)
// ─────────────────────────────────────────────────────────────────────────────

User.globalScope('notDeleted', qb => qb.whereNull('deleted_at'));

// ─────────────────────────────────────────────────────────────────────────────
//  3.  CREATE / INSERT
// ─────────────────────────────────────────────────────────────────────────────

(async () => {

// create — INSERT + returns hydrated Model instance
const user = await User.create({ name: 'Alice', email: 'alice@ex.com', age: 30, active: 1 });

// createMany — INSERT multiple, returns Model[] 
const users = await User.createMany([
    { name: 'Bob',   email: 'bob@ex.com',   age: 25 },
    { name: 'Carol', email: 'carol@ex.com', age: 22 },
]);

// createOrIgnore — silently skips on UNIQUE violation
await User.createOrIgnore({ email: 'alice@ex.com', name: 'Alice' });

// firstOrCreate — find or insert
const admin = await User.firstOrCreate({ email: 'admin@ex.com' }, { name: 'Admin', active: 1 });

// updateOrCreate — upsert
const upserted = await User.updateOrCreate({ email: 'bob@ex.com' }, { name: 'Bobby', age: 26 });

// Low-level insert (returns raw DB result, no hydration)
await User.insert({ name: 'Dave', email: 'd@ex.com', age: 40 });
await User.insertMany([{ name: 'Eve', email: 'e@ex.com' }]);

// ─────────────────────────────────────────────────────────────────────────────
//  4.  FIND / READ
// ─────────────────────────────────────────────────────────────────────────────

await User.find(1);                       // by PK, null if missing
await User.findOrFail(1);                 // throws if missing
await User.findBy('email', 'a@ex.com');   // first match by col/val
await User.findOne({ name: 'Alice' });    // first match by conditions object
await User.findAll('active', 1);          // all rows where active = 1
await User.all();                         // every row
await User.first();                       // first row
await User.last();                        // last row (by PK desc)
await User.get();                         // alias for all()

// ─────────────────────────────────────────────────────────────────────────────
//  5.  WHERE CLAUSES
// ─────────────────────────────────────────────────────────────────────────────

await User.where('active', 1).get();
await User.whereOp('age', '>=', 18).get();
await User.orWhere('name', 'Bob').get();
await User.orWhereOp('age', '<', 10).get();
await User.whereIn('id', [1, 2, 3]).get();
await User.whereNotIn('id', [4, 5]).get();
await User.whereNull('deleted_at').get();
await User.whereNotNull('email').get();
await User.whereBetween('age', 18, 65).get();
await User.whereNotBetween('age', 0, 17).get();
await User.whereLike('name', 'Al%').get();
await User.whereILike('name', 'al%').get();            // case-insensitive
await User.whereRaw('"age" > ? AND "active" = ?', [18, 1]).get();

// Chaining
await User
    .where('active', 1)
    .whereOp('age', '>=', 18)
    .whereLike('name', 'A%')
    .get();

// ─────────────────────────────────────────────────────────────────────────────
//  6.  SELECT / DISTINCT / PLUCK / KEY-BY / CHUNK
// ─────────────────────────────────────────────────────────────────────────────

await User.select('id', 'name', 'email').get();
await User.distinct().pluck('name');                   // unique name values
await User.select('id', 'name').distinct().get();
await User.keyBy('id');                                // { 1: User, 2: User, … }

// chunk — process 100 rows at a time
await User.where('active', 1).chunk(100, async (batch) => {
    for (const u of batch) console.log(u.name);
});

// ─────────────────────────────────────────────────────────────────────────────
//  7.  PAGINATE
// ─────────────────────────────────────────────────────────────────────────────

const page = await User.where('active', 1).orderBy('name').paginate(1, 20);
// {
//   data: User[],
//   total: 100,
//   per_page: 20,
//   current_page: 1,
//   last_page: 5,
//   from: 1,
//   to: 20,
// }

// Chain with find:
const result = await User.find(1).paginate(1, 10);
const paging = await User.paginate(1, 10);
// Note: find() returns a Promise<Model|null>; call paginate on QB instead:
const paged  = await User.where('active', 1).paginate(2, 15);

// ─────────────────────────────────────────────────────────────────────────────
//  8.  ORDER / GROUP / HAVING / LIMIT / OFFSET
// ─────────────────────────────────────────────────────────────────────────────

await User.orderBy('name').get();
await User.orderByDesc('created_at').limit(5).get();
await User.orderByRaw('"age" * 2 DESC').get();
await User.groupBy('active').select('active', 'COUNT(*) as total').groupByRaw('"active"').get();
await User.having('COUNT(*) > 1').groupBy('active').get();
await User.limit(10).offset(20).get();

// ─────────────────────────────────────────────────────────────────────────────
//  9.  JOINS
// ─────────────────────────────────────────────────────────────────────────────

await User.join('posts', 'id', '=', 'user_id').get();
await User.leftJoin('profiles', 'id', '=', 'user_id').select('users.name','profiles.bio').get();
await User.innerJoin('roles_users', 'id', '=', 'user_id').get();
await User.joinRaw('LEFT JOIN "profiles" ON "users"."id" = "profiles"."user_id"').get();

// ─────────────────────────────────────────────────────────────────────────────
//  10.  AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

await User.count();                          // total rows
await User.where('active', 1).count();       // filtered count
await User.sum('age');
await User.avg('age');
await User.min('age');
await User.max('age');
await User.where('active', 1).exists();      // true / false
await User.where('active', 0).doesntExist(); // true / false

// ─────────────────────────────────────────────────────────────────────────────
//  11.  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

await User.update(1, { name: 'Alice B.' });
await User.updateMany([[1, { active: 0 }], [2, { active: 0 }]]);
await User.updateWhere({ active: 0 }, { deleted_at: new Date().toISOString() });

// On an instance:
const u = await User.find(1);
await u.update({ name: 'Alice C.' });
await u.save();                  // persists dirty changes

// ─────────────────────────────────────────────────────────────────────────────
//  12.  DELETE
// ─────────────────────────────────────────────────────────────────────────────

await User.delete(1);
await User.deleteMany([1, 2, 3]);
await User.deleteWhere({ active: 0 });
await User.destroy(5);                    // alias for delete
await User.truncate();                    // wipe entire table

// On an instance:
const u2 = await User.find(2);
await u2.delete();

// ─────────────────────────────────────────────────────────────────────────────
//  13.  INCREMENT / DECREMENT
// ─────────────────────────────────────────────────────────────────────────────

await User.where('id', 1).increment('age');        // +1
await User.where('id', 1).increment('age', 5);     // +5
await User.where('id', 1).decrement('age', 2);     // -2

// On an instance:
const u3 = await User.find(3);
await u3.increment('age');
await u3.decrement('age', 3);

// ─────────────────────────────────────────────────────────────────────────────
//  14.  REFRESH / RELOAD
// ─────────────────────────────────────────────────────────────────────────────

const u4 = await User.find(1);
await u4.refresh();    // re-read from DB in-place
await u4.reload();     // alias

// ─────────────────────────────────────────────────────────────────────────────
//  15.  SCOPES
// ─────────────────────────────────────────────────────────────────────────────

await User.scope('active').get();
await User.scope('adults').orderBy('name').get();
await User.scope('older', 21).get();    // passes extra arg to scope fn

// ─────────────────────────────────────────────────────────────────────────────
//  16.  RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

const u5 = await User.find(1);

// hasMany
const posts   = await u5.hasMany(Post, 'user_id');

// hasOne
const profile = await u5.hasOne(Profile, 'user_id');

// belongsTo
const post    = await Post.find(1);
const author  = await post.belongsTo(User, 'user_id');

// belongsToMany (pivot)
const roles   = await u5.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');

// Named relation methods (defined on the model)
const myPosts = await u5.posts();

// ─────────────────────────────────────────────────────────────────────────────
//  17.  PIVOT: ATTACH / DETACH / SYNC
// ─────────────────────────────────────────────────────────────────────────────

await u5.attach('user_roles', 'user_id', 'role_id', [1, 2, 3]);
await u5.detach('user_roles', 'user_id', 'role_id', [3]);
await u5.detach('user_roles', 'user_id', 'role_id');        // detach all
await u5.sync('user_roles', 'user_id', 'role_id', [1, 2]); // replace all

// ─────────────────────────────────────────────────────────────────────────────
//  18.  EAGER LOAD / LAZY LOAD
// ─────────────────────────────────────────────────────────────────────────────

await u5.eagerLoad('posts');    // u5.posts is now populated
await u5.lazyLoad('profile');   // same, semantic alias

// Via QueryBuilder:
const usersWithPosts = await User.with('posts').get();
const usersWithCounts = await User.withCount('posts').get();
// → each user has posts_count property

// ─────────────────────────────────────────────────────────────────────────────
//  19.  SERIALIZE
// ─────────────────────────────────────────────────────────────────────────────

const u6 = await User.find(1);
console.log(u6.toJSON());    // plain object, no _ internals
console.log(u6.toArray());   // [ ['id', 1], ['name', 'Alice'], … ]

// ─────────────────────────────────────────────────────────────────────────────
//  20.  RAW SQL
// ─────────────────────────────────────────────────────────────────────────────

await User.raw('SELECT * FROM users WHERE age > ?', [18]);
await User.query('UPDATE users SET active = 1 WHERE id = ?', [1]);

})();


// ─────────────────────────────────────────────────────────────────────────────
//  For Full Example
// ─────────────────────────────────────────────────────────────────────────────
 var items = [
        { name: 'Item 1', price: 12.3 },
        { name: 'Item 2', price: 7.8 },
        { name: 'Item 3', price: 19.5 },
        { name: 'Item 4', price: 5.4 },
        { name: 'Item 5', price: 22.1 },
        { name: 'Item 6', price: 9.9 },
        { name: 'Item 7', price: 14.7 },
        { name: 'Item 8', price: 3.6 },
        { name: 'Item 9', price: 17.2 },
        { name: 'Item 10', price: 11.0 },
        { name: 'Item 11', price: 6.3 },
        { name: 'Item 12', price: 25.8 },
        { name: 'Item 13', price: 8.1 },
        { name: 'Item 14', price: 13.4 },
        { name: 'Item 15', price: 4.9 },
        { name: 'Item 16', price: 21.7 },
        { name: 'Item 17', price: 16.2 },
        { name: 'Item 18', price: 10.6 },
        { name: 'Item 19', price: 2.8 },
        { name: 'Item 20', price: 18.9 },
        { name: 'Item 21', price: 7.2 },
        { name: 'Item 22', price: 23.5 },
        { name: 'Item 23', price: 9.1 },
        { name: 'Item 24', price: 15.8 },
        { name: 'Item 25', price: 6.7 },
        { name: 'Item 26', price: 20.4 },
        { name: 'Item 27', price: 11.9 },
        { name: 'Item 28', price: 3.3 },
        { name: 'Item 29', price: 24.6 },
        { name: 'Item 30', price: 13.0 }
    ];


    class Items extends Model {
        static table    = 'items';
        static fillable = ['name', 'price'];
    }
  
    var result = await Items.createMany(items);