'use strict';

/**
 * ════════════════════════════════════════════════════════════════════
 *  MongoModel ORM — Usage Guide & Cheatsheet
 *  Requires: mongo-model.js  +  database.js  +  mongo-schema.js
 * ════════════════════════════════════════════════════════════════════
 */

const { MongoModel }  = require('./model');   // your existing schema file
const { MongoSchema } =  require('./schema.mongo.db');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
//  1.  REGISTER SCHEMA + DEFINE MODEL
// ─────────────────────────────────────────────────────────────────────────────

// Step 1 — register the Mongoose model via MongoSchema
await MongoSchema.create('User', (col) => {
    col.string('name').notNullable().trim();
    col.string('email').unique().notNullable().lowercase();
    col.integer('age').min(0).nullable();
    col.boolean('isActive').default(true);
    col.array('roleIds', mongoose.Schema.Types.ObjectId).nullable();
    col.timestamps();
});

await MongoSchema.create('Post', (col) => {
    col.string('title').notNullable();
    col.string('body').nullable();
    col.foreignId('userId', 'User').notNullable();
    col.timestamps();
});

await MongoSchema.create('Role', (col) => {
    col.string('name').unique().notNullable();
});

// Step 2 — define your MongoModel subclass (modelName must match MongoSchema name)
class User extends MongoModel {
    static modelName = 'User';
    static fillable  = ['name', 'email', 'age', 'isActive', 'roleIds'];

    // ── Local scopes ─────────────────────────────────────────────────────────
    static scopes = {
        active: (qb)         => qb.where('isActive', true),
        adults: (qb)         => qb.whereOp('age', '>=', 18),
        older:  (qb, minAge) => qb.whereOp('age', '>=', minAge),
    };

    // ── Relations ─────────────────────────────────────────────────────────────
    async posts()   { return this.hasMany(Post, 'userId'); }
    async profile() { return this.hasOne(Profile, 'userId'); }
    // belongsToMany via local array field:
    async roles()   { return this.belongsToMany(Role, 'roleIds'); }
}

class Post extends MongoModel {
    static modelName = 'Post';
    static fillable  = ['title', 'body', 'userId'];

    async author() { return this.belongsTo(User, 'userId'); }
}

class Profile extends MongoModel { static modelName = 'Profile'; }
class Role    extends MongoModel { static modelName = 'Role'; }

// ─────────────────────────────────────────────────────────────────────────────
//  2.  GLOBAL SCOPES  (auto-applied to every query)
// ─────────────────────────────────────────────────────────────────────────────

User.globalScope('notDeleted', qb => qb.whereNull('deletedAt'));

// ─────────────────────────────────────────────────────────────────────────────
//  3.  CREATE / INSERT
// ─────────────────────────────────────────────────────────────────────────────

(async () => {

// create — returns hydrated MongoModel instance
const user = await User.create({ name: 'Alice', email: 'alice@ex.com', age: 30, isActive: true });

// createMany — returns MongoModel[]
const users = await User.createMany([
    { name: 'Bob',   email: 'bob@ex.com',   age: 25 },
    { name: 'Carol', email: 'carol@ex.com', age: 22 },
]);

// createOrIgnore — returns null on duplicate key (11000), throws on other errors
await User.createOrIgnore({ email: 'alice@ex.com', name: 'Alice' });

// firstOrCreate — find or insert
const admin = await User.firstOrCreate({ email: 'admin@ex.com' }, { name: 'Admin', isActive: true });

// updateOrCreate — findOneAndUpdate with upsert: true
const upserted = await User.updateOrCreate({ email: 'bob@ex.com' }, { name: 'Bobby', age: 26 });

// Low-level insert — returns raw Mongoose document
await User.insert({ name: 'Dave', email: 'd@ex.com', age: 40 });

// Low-level insertMany — uses Mongoose insertMany (faster for bulk)
await User.insertMany([{ name: 'Eve', email: 'e@ex.com', age: 28 }]);

// ─────────────────────────────────────────────────────────────────────────────
//  4.  FIND / READ
// ─────────────────────────────────────────────────────────────────────────────

await User.find('64abc...');              // by _id (auto-casts string → ObjectId)
await User.findById('64abc...');          // alias for find
await User.findOrFail('64abc...');        // throws if not found
await User.findBy('email', 'a@ex.com');   // first match by field/value
await User.findOne({ name: 'Alice' });    // first match by conditions object
await User.findAll('isActive', true);     // all where isActive = true
await User.all();                         // every document
await User.first();                       // first document
await User.last();                        // last document (by _id desc)
await User.get();                         // alias for all()

// ─────────────────────────────────────────────────────────────────────────────
//  5.  WHERE CLAUSES
// ─────────────────────────────────────────────────────────────────────────────

await User.where('isActive', true).get();
await User.whereOp('age', '>=', 18).get();
await User.whereOp('age', '!=', 0).get();
await User.orWhere('name', 'Bob').get();
await User.orWhereOp('age', '<', 10).get();
await User.andWhere('isActive', true).get();
await User.whereIn('_id', ['64a...', '64b...']).get();
await User.whereNotIn('_id', ['64c...']).get();
await User.whereNull('deletedAt').get();
await User.whereNotNull('email').get();
await User.whereBetween('age', 18, 65).get();
await User.whereNotBetween('age', 0, 17).get();
await User.whereLike('name', 'Al%').get();              // SQL-style: % = .*, _ = .
await User.whereILike('name', 'al%').get();             // case-insensitive
await User.whereRaw({ age: { $gt: 18 }, isActive: true }).get();  // raw Mongo filter

// Chaining
await User
    .where('isActive', true)
    .whereOp('age', '>=', 18)
    .whereLike('name', 'A%')
    .get();

// ─────────────────────────────────────────────────────────────────────────────
//  6.  SELECT / DISTINCT / PLUCK / KEY-BY / CHUNK
// ─────────────────────────────────────────────────────────────────────────────

await User.select('name', 'email').get();
await User.distinct().pluck('name');                    // unique name values
await User.where('isActive', true).pluck('email');      // array of emails
await User.keyBy('email');                              // { 'a@b.com': User, … }

await User.where('isActive', true).chunk(100, async (batch) => {
    for (const u of batch) console.log(u.name);
});

// ─────────────────────────────────────────────────────────────────────────────
//  7.  PAGINATE
// ─────────────────────────────────────────────────────────────────────────────

const page = await User.where('isActive', true).orderBy('name').paginate(1, 20);
// {
//   data: MongoModel[],
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
await User.orderByDesc('createdAt').limit(5).get();
await User.orderByRaw({ age: -1, name: 1 }).get();
await User.groupBy('isActive').get();
await User.groupByRaw(['isActive', 'age']).get();
await User.having({ count: { $gt: 1 } }).groupBy('isActive').get();
await User.limit(10).offset(20).get();

// ─────────────────────────────────────────────────────────────────────────────
//  9.  JOINS ($lookup — aggregation pipeline)
// ─────────────────────────────────────────────────────────────────────────────

// join(collection, localField, foreignField, as)
await User.join('posts', '_id', 'userId', 'userPosts').get();
await User.leftJoin('profiles', '_id', 'userId', 'profile').get();
await User.innerJoin('roles', '_id', 'userId', 'roles').get();

// Raw $lookup stage
await User.joinRaw({
    from: 'posts',
    let: { userId: '$_id' },
    pipeline: [{ $match: { $expr: { $eq: ['$userId', '$$userId'] } } }],
    as: 'posts',
}).get();

// ─────────────────────────────────────────────────────────────────────────────
//  10.  AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

await User.count();                              // total documents
await User.where('isActive', true).count();      // filtered count
await User.count('email');                       // count where email exists
await User.sum('age');
await User.avg('age');
await User.min('age');
await User.max('age');
await User.where('isActive', true).exists();     // true / false
await User.where('isActive', false).doesntExist();

// ─────────────────────────────────────────────────────────────────────────────
//  11.  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

await User.update('64abc...', { name: 'Alice B.' });
await User.updateMany([['64a...', { isActive: false }], ['64b...', { isActive: false }]]);
await User.updateWhere({ isActive: false }, { deletedAt: new Date() });

// QueryBuilder updateWhere:
await User.where('age', 0).updateWhere({ isActive: false });

// On an instance:
const u = await User.find('64abc...');
await u.update({ name: 'Alice C.' });
await u.save();

// ─────────────────────────────────────────────────────────────────────────────
//  12.  DELETE
// ─────────────────────────────────────────────────────────────────────────────

await User.delete('64abc...');
await User.deleteMany(['64a...', '64b...', '64c...']);
await User.deleteWhere({ isActive: false });
await User.destroy('64abc...');              // alias for delete
await User.truncate();                       // wipe entire collection

// On an instance:
const u2 = await User.find('64b...');
await u2.delete();

// ─────────────────────────────────────────────────────────────────────────────
//  13.  INCREMENT / DECREMENT
// ─────────────────────────────────────────────────────────────────────────────

await User.where('_id', '64abc...').increment('age');        // +1
await User.where('_id', '64abc...').increment('age', 5);     // +5
await User.where('_id', '64abc...').decrement('age', 2);     // -2

// On an instance:
const u3 = await User.find('64c...');
await u3.increment('age');
await u3.decrement('age', 3);

// ─────────────────────────────────────────────────────────────────────────────
//  14.  REFRESH / RELOAD
// ─────────────────────────────────────────────────────────────────────────────

const u4 = await User.find('64abc...');
await u4.refresh();
await u4.reload();  // alias

// ─────────────────────────────────────────────────────────────────────────────
//  15.  SCOPES
// ─────────────────────────────────────────────────────────────────────────────

await User.scope('active').get();
await User.scope('adults').orderBy('name').get();
await User.scope('older', 21).get();

// ─────────────────────────────────────────────────────────────────────────────
//  16.  RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

const u5 = await User.find('64abc...');

const posts   = await u5.hasMany(Post, 'userId');
const profile = await u5.hasOne(Profile, 'userId');
const post    = await Post.find('64p...');
const author  = await post.belongsTo(User, 'userId');

// belongsToMany (array field on document)
const roles   = await u5.belongsToMany(Role, 'roleIds');

// Named relation methods
const myPosts = await u5.posts();

// ─────────────────────────────────────────────────────────────────────────────
//  17.  ATTACH / DETACH / SYNC  (array-based many-to-many)
// ─────────────────────────────────────────────────────────────────────────────

// Uses $addToSet so duplicates are automatically prevented
await u5.attach('roleIds', ['64r1...', '64r2...']);

// $pull specific IDs
await u5.detach('roleIds', ['64r2...']);

// Clear entire array
await u5.detach('roleIds');

// Replace array entirely
await u5.sync('roleIds', ['64r1...', '64r3...']);

// ─────────────────────────────────────────────────────────────────────────────
//  18.  EAGER LOAD / LAZY LOAD / WITH
// ─────────────────────────────────────────────────────────────────────────────

await u5.eagerLoad('posts');    // u5.posts is now populated
await u5.lazyLoad('profile');   // alias

// Via QueryBuilder (uses Mongoose .populate()):
const usersWithPosts = await User.with('posts').get();

// Count via withCount:
const usersWithCounts = await User.withCount('posts').get();
// → each user has posts_count property

// ─────────────────────────────────────────────────────────────────────────────
//  19.  SERIALIZE
// ─────────────────────────────────────────────────────────────────────────────

const u6 = await User.find('64abc...');
console.log(u6.toJSON());    // plain object, _id included, _ internals stripped
console.log(u6.toArray());   // [['_id', ...], ['name', ...], ...]

// ─────────────────────────────────────────────────────────────────────────────
//  20.  RAW AGGREGATION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

await User.raw([
    { $match: { isActive: true } },
    { $group: { _id: '$age', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
]);

// Alias:
await User.query([{ $match: { isActive: true } }]);

// ─────────────────────────────────────────────────────────────────────────────
//  21.  MIGRATE / ROLLBACK / SEED
// ─────────────────────────────────────────────────────────────────────────────

// Sync indexes declared in the schema
await User.migrate();

// Drop all indexes (except _id)
await User.rollbackMigration();

// Seed documents — skips duplicates safely
await Role.seed([
    { name: 'admin' },
    { name: 'editor' },
    { name: 'viewer' },
]);

})();

// ─────────────────────────────────────────────────────────────────────────────
//  KEY DIFFERENCES vs SQLite ORM
// ─────────────────────────────────────────────────────────────────────────────

/*
  SQLite ORM             │  MongoDB ORM
  ─────────────────────────────────────────────────────────────────────
  find(id)               │  find(id) — auto-casts string → ObjectId
  table = 'users'        │  modelName = 'User'
  references('table')    │  references('ModelName') — for populate
  integer('x').ref()     │  foreignId('x', 'ModelName')
  pivot table            │  array field on document (attach/detach/sync)
  whereRaw(sql, [?])     │  whereRaw({ mongoFilter })
  orderByRaw('sql')      │  orderByRaw({ field: 1 })
  having('sql', [?])     │  having({ mongoFilter })
  joinRaw('sql')         │  joinRaw($lookup stage object)
  truncate()             │  truncate() — deleteMany({})
  migrate()              │  migrate() — ensureIndexes()
  rollbackMigration()    │  rollbackMigration() — dropIndexes()
  seed(rows)             │  seed(rows) — createOrIgnore each row
*/