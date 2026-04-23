'use strict';

const { mongoose, Database } = require('./database');

// ─── QueryBuilder ─────────────────────────────────────────────────────────────

/**
 * QueryBuilder
 *
 * Chainable Mongoose query builder that mirrors the SQLite ORM API exactly.
 * Every Model static method returns a QueryBuilder for free chaining.
 *
 * @example
 * const users = await User.where('active', true).orderBy('name').limit(10).get();
 */
class QueryBuilder {

    /**
     * @param {typeof MongoModel} model  - The MongoModel subclass this builder is bound to
     */
    constructor(model) {
        this._model       = model;

        // FILTER (Mongoose filter object)
        this._filter      = {};           // accumulated $and / $or conditions
        this._filterStack = [];           // { logic: 'and'|'or', condition: {} }[]

        // PROJECTION
        this._projection  = null;         // null = select all
        this._distinctCol = null;

        // POPULATE (with / eager load)
        this._populates   = [];           // string[]
        this._populateCounts = [];        // string[]

        // PIPELINE extras (aggregation)
        this._aggregatePipeline = null;   // set when join / group / aggregate needed

        // SORT
        this._sort        = {};

        // PAGINATION
        this._limitVal    = null;
        this._offsetVal   = null;

        // GROUP / HAVING
        this._groupFields  = null;
        this._havingFilter = null;

        // LOOKUP JOINS
        this._lookups     = [];           // $lookup stages

        // SCOPES
        this._scopesApplied = false;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    _applyGlobalScopes() {
        if (this._scopesApplied) return;
        this._scopesApplied = true;
        const scopes = this._model._globalScopes || {};
        for (const fn of Object.values(scopes)) fn(this);
    }

    /** Merge all stacked conditions into a single Mongoose filter object */
    _buildFilter() {
        this._applyGlobalScopes();
        if (!this._filterStack.length) return this._filter;

        const andClauses = [this._filter];
        const orGroups   = [];
        let   currentOr  = null;

        for (const entry of this._filterStack) {
            if (entry.logic === 'or') {
                if (!currentOr) currentOr = [];
                currentOr.push(entry.condition);
            } else {
                if (currentOr) {
                    orGroups.push({ $or: currentOr });
                    currentOr = null;
                }
                andClauses.push(entry.condition);
            }
        }

        if (currentOr) orGroups.push({ $or: currentOr });

        const all = [...andClauses, ...orGroups].filter(c => Object.keys(c).length > 0);
        if (!all.length) return {};
        if (all.length === 1) return all[0];
        return { $and: all };
    }

    _pushAnd(condition) {
        this._filterStack.push({ logic: 'and', condition });
        return this;
    }

    _pushOr(condition) {
        this._filterStack.push({ logic: 'or', condition });
        return this;
    }

    /** Returns whether we need aggregation pipeline (joins / group / having) */
    _needsAggregate() {
        return this._lookups.length > 0 || this._groupFields !== null;
    }

    /** Build aggregation pipeline array */
    _buildPipeline() {
        const pipeline = [];

        // $match
        const filter = this._buildFilter();
        if (Object.keys(filter).length) pipeline.push({ $match: filter });

        // $lookup (joins)
        for (const lookup of this._lookups) pipeline.push({ $lookup: lookup });

        // $group
        if (this._groupFields) {
            const groupId = {};
            for (const f of this._groupFields) groupId[f] = `$${f}`;
            const groupStage = { _id: Object.keys(groupId).length === 1 ? Object.values(groupId)[0] : groupId };
            if (this._groupAggregates) Object.assign(groupStage, this._groupAggregates);
            pipeline.push({ $group: groupStage });
        }

        // $having (post-group $match)
        if (this._havingFilter) pipeline.push({ $match: this._havingFilter });

        // $sort
        if (Object.keys(this._sort).length) pipeline.push({ $sort: this._sort });

        // $skip / $limit
        if (this._offsetVal) pipeline.push({ $skip: this._offsetVal });
        if (this._limitVal  !== null) pipeline.push({ $limit: this._limitVal });

        // $project
        if (this._projection) pipeline.push({ $project: this._projection });

        return pipeline;
    }

    /** Execute find via aggregate or standard Mongoose find */
    async _execFind() {
        const MongooseModel = this._model._mongooseModel();

        if (this._needsAggregate()) {
            const pipeline = this._buildPipeline();
            const docs = await MongooseModel.aggregate(pipeline).exec();
            return docs;
        }

        const filter = this._buildFilter();
        let q = MongooseModel.find(filter);
        if (this._projection)   q = q.select(this._projection);
        if (Object.keys(this._sort).length) q = q.sort(this._sort);
        if (this._offsetVal)    q = q.skip(this._offsetVal);
        if (this._limitVal !== null) q = q.limit(this._limitVal);
        for (const p of this._populates) q = q.populate(p);
        const docs = await q.lean().exec();
        return docs;
    }

    /** Hydrate raw docs into MongoModel instances */
    _hydrate(docs) {
        return docs.map(doc => {
            const inst = new this._model();
            Object.assign(inst, doc);
            inst._id     = doc._id;
            inst._exists = true;
            inst._original = { ...doc };
            return inst;
        });
    }

    async _eagerLoadCounts(instances) {
        for (const relName of this._populateCounts) {
            const fn = this._model.prototype[relName];
            if (typeof fn !== 'function') continue;
            for (const inst of instances) {
                const related = await fn.call(inst);
                inst[`${relName}_count`] = Array.isArray(related) ? related.length : (related ? 1 : 0);
            }
        }
    }

    // ─── SELECT / PROJECTION ──────────────────────────────────────────────────

    /**
     * Select specific fields (Mongoose projection).
     * @param {...string} fields
     */
    select(...fields) {
        this._projection = this._projection || {};
        for (const f of fields.flat()) this._projection[f] = 1;
        return this;
    }

    /** Add distinct to next .pluck() call */
    distinct() {
        this._isDistinct = true;
        return this;
    }

    // ─── WHERE / FILTER ───────────────────────────────────────────────────────

    /** WHERE field = value */
    where(field, value) {
        return this._pushAnd({ [field]: value });
    }

    /**
     * WHERE field <op> value
     * Supported ops: =, !=, <>, <, >, <=, >=, LIKE, NOT LIKE
     */
    whereOp(field, op, value) {
        const map = {
            '='    : null,
            '!='   : '$ne',
            '<>'   : '$ne',
            '>'    : '$gt',
            '>='   : '$gte',
            '<'    : '$lt',
            '<='   : '$lte',
            'LIKE' : '__like',
            'NOT LIKE': '__notlike',
        };
        const m = map[op.toUpperCase()] ?? map[op];
        if (m === null)        return this._pushAnd({ [field]: value });
        if (m === '__like')    return this.whereLike(field, value);
        if (m === '__notlike') return this._pushAnd({ [field]: { $not: _likeToRegex(value) } });
        return this._pushAnd({ [field]: { [m]: value } });
    }

    /** OR WHERE field = value */
    orWhere(field, value) {
        return this._pushOr({ [field]: value });
    }

    /** OR WHERE field <op> value */
    orWhereOp(field, op, value) {
        const clone = new QueryBuilder(this._model);
        clone.whereOp(field, op, value);
        const cond = clone._buildFilter();
        return this._pushOr(cond);
    }

    /** AND WHERE (alias for where) */
    andWhere(field, value) {
        return this.where(field, value);
    }

    /** WHERE field IN [...values] */
    whereIn(field, values) {
        return this._pushAnd({ [field]: { $in: values } });
    }

    /** WHERE field NOT IN [...values] */
    whereNotIn(field, values) {
        return this._pushAnd({ [field]: { $nin: values } });
    }

    /** WHERE field IS NULL (does not exist or is null) */
    whereNull(field) {
        return this._pushAnd({ [field]: { $in: [null, undefined] } });
    }

    /** WHERE field IS NOT NULL */
    whereNotNull(field) {
        return this._pushAnd({ [field]: { $nin: [null, undefined], $exists: true } });
    }

    /** WHERE field BETWEEN min AND max */
    whereBetween(field, min, max) {
        return this._pushAnd({ [field]: { $gte: min, $lte: max } });
    }

    /** WHERE field NOT BETWEEN min AND max */
    whereNotBetween(field, min, max) {
        return this._pushAnd({ [field]: { $not: { $gte: min, $lte: max } } });
    }

    /** WHERE field LIKE pattern (SQL-style %, _ wildcards) */
    whereLike(field, pattern) {
        return this._pushAnd({ [field]: _likeToRegex(pattern) });
    }

    /** WHERE field LIKE pattern (case-insensitive) */
    whereILike(field, pattern) {
        return this._pushAnd({ [field]: _likeToRegex(pattern, 'i') });
    }

    /**
     * Raw filter — pass a plain Mongoose filter object directly.
     * @param {object} filterObj
     */
    whereRaw(filterObj) {
        return this._pushAnd(filterObj);
    }

    // ─── JOIN (via $lookup) ───────────────────────────────────────────────────

    _addLookup(from, localField, foreignField, as) {
        this._lookups.push({ from, localField, foreignField, as: as || from });
        return this;
    }

    /** $lookup — equivalent to INNER JOIN (filter nulls post-lookup for inner behaviour) */
    join(collection, localField, foreignField, as)      { return this._addLookup(collection, localField, foreignField, as); }
    innerJoin(collection, localField, foreignField, as) { return this._addLookup(collection, localField, foreignField, as); }

    /** $lookup LEFT — returns docs even when no match (same as Mongo's default $lookup) */
    leftJoin(collection, localField, foreignField, as)  { return this._addLookup(collection, localField, foreignField, as); }

    /** MongoDB has no RIGHT/FULL JOIN — emulated as $lookup (left) */
    rightJoin(collection, localField, foreignField, as) { return this._addLookup(collection, localField, foreignField, as); }
    outerJoin(collection, localField, foreignField, as) { return this._addLookup(collection, localField, foreignField, as); }
    fullJoin(collection, localField, foreignField, as)  { return this._addLookup(collection, localField, foreignField, as); }

    /** Raw $lookup stage object */
    joinRaw(lookupStage) {
        this._lookups.push(lookupStage);
        return this;
    }

    // ─── ORDER ────────────────────────────────────────────────────────────────

    /** ORDER BY field ASC */
    orderBy(field, dir = 'asc') {
        this._sort[field] = dir.toLowerCase() === 'desc' ? -1 : 1;
        return this;
    }

    /** ORDER BY field DESC */
    orderByDesc(field) {
        return this.orderBy(field, 'desc');
    }

    /**
     * Raw sort object — e.g. orderByRaw({ score: -1, name: 1 })
     * @param {object} sortObj
     */
    orderByRaw(sortObj) {
        Object.assign(this._sort, sortObj);
        return this;
    }

    // ─── GROUP / HAVING ───────────────────────────────────────────────────────

    /** GROUP BY field (sets up $group stage in aggregation pipeline) */
    groupBy(field) {
        this._groupFields = this._groupFields || [];
        this._groupFields.push(field);
        return this;
    }

    /**
     * Raw group fields array — groupByRaw(['city', 'country'])
     * @param {string[]} fields
     */
    groupByRaw(fields) {
        this._groupFields = Array.isArray(fields) ? fields : [fields];
        return this;
    }

    /**
     * HAVING — post-group filter.
     * @param {object} filterObj  - Mongoose filter object applied after $group
     */
    having(filterObj) {
        this._havingFilter = filterObj;
        return this;
    }

    // ─── LIMIT / OFFSET ───────────────────────────────────────────────────────

    limit(n) {
        this._limitVal = n;
        return this;
    }

    offset(n) {
        this._offsetVal = n;
        return this;
    }

    // ─── EAGER LOAD / WITH ────────────────────────────────────────────────────

    /** Populate (eager-load) named relation fields */
    with(...relations) {
        this._populates.push(...relations.flat());
        return this;
    }

    /** Attach counts for named relations */
    withCount(...relations) {
        this._populateCounts.push(...relations.flat());
        return this;
    }

    // ─── FETCH METHODS ────────────────────────────────────────────────────────

    /**
     * Execute and return all matching documents as MongoModel instances.
     * @returns {Promise<MongoModel[]>}
     */
    async get() {
        const docs = await this._execFind();
        const instances = this._hydrate(docs);
        if (this._populateCounts.length) await this._eagerLoadCounts(instances);
        return instances;
    }

    /**
     * Return first matching document or null.
     * @returns {Promise<MongoModel|null>}
     */
    async first() {
        this._limitVal = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /**
     * Return last document by _id (or overridden PK).
     * @returns {Promise<MongoModel|null>}
     */
    async last() {
        this.orderByDesc(this._model.primaryKey);
        this._limitVal = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /**
     * Find by primary key (_id by default). Returns instance or null.
     * @param {*} id
     */
    async find(id) {
        return this.where(this._model.primaryKey, _castId(id)).first();
    }

    /**
     * Find by primary key. Throws if not found.
     * @param {*} id
     */
    async findOrFail(id) {
        const doc = await this.find(id);
        if (!doc) throw new Error(`${this._model.name}: No record found for id=${id}`);
        return doc;
    }

    /**
     * Find the first document matching a field/value pair.
     * @param {string} field
     * @param {*}      value
     */
    async findBy(field, value) {
        return this.where(field, value).first();
    }

    /**
     * Find one document matching a conditions object.
     * @param {object} conditions
     */
    async findOne(conditions = {}) {
        for (const [k, v] of Object.entries(conditions)) this.where(k, v);
        return this.first();
    }

    /**
     * Find all documents matching a field/value pair.
     * @param {string} field
     * @param {*}      value
     */
    async findAll(field, value) {
        return this.where(field, value).get();
    }

    /**
     * Find by MongoDB ObjectId specifically.
     * @param {string|ObjectId} id
     */
    async findById(id) {
        return this.find(id);
    }

    /** Return all documents. */
    async all() { return this.get(); }

    // ─── PLUCK / KEY-BY / CHUNK ───────────────────────────────────────────────

    /**
     * Return a flat array of values for a single field.
     * @param {string} field
     */
    async pluck(field) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();

        if (this._isDistinct) {
            return MongooseModel.distinct(field, filter).exec();
        }

        const docs = await MongooseModel.find(filter).select(field).lean().exec();
        return docs.map(d => d[field]);
    }

    /**
     * Return documents as an object keyed by the given field.
     * @param {string} field
     */
    async keyBy(field) {
        const rows = await this.get();
        return Object.fromEntries(rows.map(r => [r[field], r]));
    }

    /**
     * Process documents in chunks.
     * @param {number}   size
     * @param {Function} callback  - receives MongoModel[] chunk
     */
    async chunk(size, callback) {
        let page = 0;
        while (true) {
            const clone = this._clone();
            clone._limitVal  = size;
            clone._offsetVal = page * size;
            const rows = await clone.get();
            if (!rows.length) break;
            await callback(rows);
            if (rows.length < size) break;
            page++;
        }
    }

    /**
     * Paginate results.
     * @param {number} page    - 1-based
     * @param {number} perPage - default 15
     */
    async paginate(page = 1, perPage = 15) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        const total  = await MongooseModel.countDocuments(filter).exec();

        this._limitVal  = perPage;
        this._offsetVal = (page - 1) * perPage;
        const data = await this.get();

        return {
            data,
            total,
            per_page:     perPage,
            current_page: page,
            last_page:    Math.ceil(total / perPage) || 1,
            from:         total ? this._offsetVal + 1 : 0,
            to:           Math.min(this._offsetVal + perPage, total),
        };
    }

    // ─── AGGREGATES ───────────────────────────────────────────────────────────

    async count(field = null) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        if (field) {
            // count of documents where field exists & is not null
            const res = await MongooseModel.aggregate([
                { $match: filter },
                { $match: { [field]: { $exists: true, $ne: null } } },
                { $count: 'aggregate' },
            ]).exec();
            return res[0]?.aggregate ?? 0;
        }
        return MongooseModel.countDocuments(filter).exec();
    }

    async sum(field) {
        return this._aggregate('$sum', field);
    }

    async avg(field) {
        return this._aggregate('$avg', field);
    }

    async min(field) {
        return this._aggregate('$min', field);
    }

    async max(field) {
        return this._aggregate('$max', field);
    }

    async _aggregate(op, field) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        const res = await MongooseModel.aggregate([
            { $match: filter },
            { $group: { _id: null, aggregate: { [op]: `$${field}` } } },
        ]).exec();
        return res[0]?.aggregate ?? null;
    }

    /** Returns true if any document matches. */
    async exists() {
        return (await this.count()) > 0;
    }

    /** Returns true if NO documents match. */
    async doesntExist() {
        return !(await this.exists());
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    /**
     * UPDATE all matching documents with given data.
     * @param {object} data
     */
    async updateWhere(data) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        return MongooseModel.updateMany(filter, { $set: data }).exec();
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    /**
     * DELETE all matching documents.
     */
    async deleteWhere() {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        return MongooseModel.deleteMany(filter).exec();
    }

    // ─── INCREMENT / DECREMENT ────────────────────────────────────────────────

    /** Increment a field by `amount` for all matching documents. */
    async increment(field, amount = 1) {
        const MongooseModel = this._model._mongooseModel();
        const filter = this._buildFilter();
        return MongooseModel.updateMany(filter, { $inc: { [field]: amount } }).exec();
    }

    /** Decrement a field by `amount` for all matching documents. */
    async decrement(field, amount = 1) {
        return this.increment(field, -amount);
    }

    // ─── RAW ──────────────────────────────────────────────────────────────────

    /**
     * Run a raw aggregation pipeline.
     * @param {object[]} pipeline
     */
    async raw(pipeline) {
        const MongooseModel = this._model._mongooseModel();
        return MongooseModel.aggregate(pipeline).exec();
    }

    // ─── INTERNAL UTILS ───────────────────────────────────────────────────────

    _clone() {
        const c = new QueryBuilder(this._model);
        c._filter        = { ...this._filter };
        c._filterStack   = this._filterStack.map(e => ({ ...e }));
        c._projection    = this._projection ? { ...this._projection } : null;
        c._sort          = { ...this._sort };
        c._limitVal      = this._limitVal;
        c._offsetVal     = this._offsetVal;
        c._populates     = [...this._populates];
        c._populateCounts= [...this._populateCounts];
        c._lookups       = [...this._lookups];
        c._groupFields   = this._groupFields ? [...this._groupFields] : null;
        c._havingFilter  = this._havingFilter;
        c._scopesApplied = this._scopesApplied;
        return c;
    }
}

// ─── Utility: SQL LIKE pattern → RegExp ──────────────────────────────────────

function _likeToRegex(pattern, flags = '') {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex specials
        .replace(/%/g, '.*')                     // % → .*
        .replace(/_/g, '.');                     // _ → .
    return new RegExp(`^${escaped}$`, flags);
}

function _castId(id) {
    try {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    } catch {
        return id;
    }
}

// ─── MongoModel ───────────────────────────────────────────────────────────────

/**
 * MongoModel
 *
 * Base class for all MongoDB ORM models. Mirrors the SQLite Model API exactly.
 *
 * @example
 * class User extends MongoModel {
 *     static modelName  = 'User';      // Mongoose model name
 *     static collection = 'users';     // optional: override collection name
 *     static fillable   = ['name', 'email', 'active'];
 *
 *     // Relations
 *     async posts() { return Post.where('userId', this._id).get(); }
 * }
 */
class MongoModel {

    // ── Subclass overrides ────────────────────────────────────────────────────

    /** @type {string} Mongoose model name — matches MongoSchema.create(name) */
    static modelName = '';

    /** @type {string} Primary key field (default: _id) */
    static primaryKey = '_id';

    /** @type {string[]} Mass-assignable fields */
    static fillable = [];

    /** @type {string[]} Guarded fields */
    static guarded = [];

    /** @type {object} Named local scopes */
    static scopes = {};

    /** @type {object} Global scopes (auto-applied) */
    static _globalScopes = {};

    // ── Instance state ────────────────────────────────────────────────────────

    constructor(attributes = {}) {
        this._exists   = false;
        this._original = {};
        if (Object.keys(attributes).length) this._fill(attributes);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /** Get the registered Mongoose model for this class */
    static _mongooseModel() {
        const name = this.modelName || this.name;
        if (!mongoose.models[name])
            throw new Error(`MongoModel: Mongoose model "${name}" is not registered. Did you call MongoSchema.create('${name}', ...)?`);
        return mongoose.models[name];
    }

    static _qb() {
        return new QueryBuilder(this);
    }

    _fill(data) {
        const f = this.constructor.fillable;
        const g = this.constructor.guarded;
        for (const [k, v] of Object.entries(data)) {
            if (g.includes(k)) continue;
            if (f.length && !f.includes(k)) continue;
            this[k] = v;
        }
        return this;
    }

    _toData() {
        const pk   = this.constructor.primaryKey;
        const data = {};
        for (const k of Object.keys(this)) {
            if (k.startsWith('_')) continue;
            data[k] = this[k];
        }
        delete data[pk];
        return data;
    }

    // ─── Static query entry points ────────────────────────────────────────────

    static where(f, v)             { return this._qb().where(f, v); }
    static whereOp(f, op, v)       { return this._qb().whereOp(f, op, v); }
    static orWhere(f, v)           { return this._qb().orWhere(f, v); }
    static orWhereOp(f, op, v)     { return this._qb().orWhereOp(f, op, v); }
    static andWhere(f, v)          { return this._qb().andWhere(f, v); }
    static whereIn(f, vs)          { return this._qb().whereIn(f, vs); }
    static whereNotIn(f, vs)       { return this._qb().whereNotIn(f, vs); }
    static whereNull(f)            { return this._qb().whereNull(f); }
    static whereNotNull(f)         { return this._qb().whereNotNull(f); }
    static whereBetween(f, a, b)   { return this._qb().whereBetween(f, a, b); }
    static whereNotBetween(f, a, b){ return this._qb().whereNotBetween(f, a, b); }
    static whereLike(f, p)         { return this._qb().whereLike(f, p); }
    static whereILike(f, p)        { return this._qb().whereILike(f, p); }
    static whereRaw(obj)           { return this._qb().whereRaw(obj); }
    static select(...cols)         { return this._qb().select(...cols); }
    static distinct()              { return this._qb().distinct(); }
    static orderBy(f, d)           { return this._qb().orderBy(f, d); }
    static orderByDesc(f)          { return this._qb().orderByDesc(f); }
    static orderByRaw(obj)         { return this._qb().orderByRaw(obj); }
    static groupBy(f)              { return this._qb().groupBy(f); }
    static groupByRaw(fs)          { return this._qb().groupByRaw(fs); }
    static having(obj)             { return this._qb().having(obj); }
    static limit(n)                { return this._qb().limit(n); }
    static offset(n)               { return this._qb().offset(n); }
    static join(c, l, f, as)       { return this._qb().join(c, l, f, as); }
    static leftJoin(c, l, f, as)   { return this._qb().leftJoin(c, l, f, as); }
    static rightJoin(c, l, f, as)  { return this._qb().rightJoin(c, l, f, as); }
    static innerJoin(c, l, f, as)  { return this._qb().innerJoin(c, l, f, as); }
    static outerJoin(c, l, f, as)  { return this._qb().outerJoin(c, l, f, as); }
    static fullJoin(c, l, f, as)   { return this._qb().fullJoin(c, l, f, as); }
    static joinRaw(stage)          { return this._qb().joinRaw(stage); }
    static with(...r)              { return this._qb().with(...r); }
    static withCount(...r)         { return this._qb().withCount(...r); }
    static pluck(f)                { return this._qb().pluck(f); }
    static keyBy(f)                { return this._qb().keyBy(f); }
    static chunk(sz, cb)           { return this._qb().chunk(sz, cb); }
    static increment(f, amt)       { return this._qb().increment(f, amt); }
    static decrement(f, amt)       { return this._qb().decrement(f, amt); }
    static count(f)                { return this._qb().count(f); }
    static sum(f)                  { return this._qb().sum(f); }
    static avg(f)                  { return this._qb().avg(f); }
    static min(f)                  { return this._qb().min(f); }
    static max(f)                  { return this._qb().max(f); }
    static exists()                { return this._qb().exists(); }
    static doesntExist()           { return this._qb().doesntExist(); }
    static raw(pipeline)           { return this._qb().raw(pipeline); }
    static query(pipeline)         { return this._qb().raw(pipeline); }

    /** Apply a named local scope */
    static scope(name, ...args) {
        const fn = this.scopes[name];
        if (!fn) throw new Error(`Scope "${name}" not defined on ${this.name}`);
        const qb = this._qb();
        fn(qb, ...args);
        return qb;
    }

    /** Register a global scope (applied to every query on this model) */
    static globalScope(name, fn) {
        this._globalScopes = { ...this._globalScopes, [name]: fn };
    }

    // ─── FIND ─────────────────────────────────────────────────────────────────

    static find(id)             { return this._qb().find(id); }
    static findById(id)         { return this._qb().findById(id); }
    static findOrFail(id)       { return this._qb().findOrFail(id); }
    static findBy(field, value) { return this._qb().findBy(field, value); }
    static findOne(conditions)  { return this._qb().findOne(conditions); }
    static findAll(field, value){ return this._qb().findAll(field, value); }
    static all()                { return this._qb().all(); }
    static first()              { return this._qb().first(); }
    static last()               { return this._qb().last(); }
    static get()                { return this._qb().get(); }
    static paginate(page, pp)   { return this._qb().paginate(page, pp); }

    // ─── INSERT / CREATE ──────────────────────────────────────────────────────

    /**
     * INSERT a document and return hydrated MongoModel instance.
     * @param {object} data
     */
    static async create(data) { 
        const MongooseModel = this._mongooseModel();
        const doc = await MongooseModel.create(data); 
        const inst = new this();
        Object.assign(inst, doc.toObject());
        inst._exists   = true;
        inst._original = doc.toObject();
        return inst;
    }

    /**
     * INSERT OR IGNORE — silently skips on duplicate key errors.
     * @param {object} data
     */
    static async createOrIgnore(data) {
        try {
            return await this.create(data);
        } catch (err) {
            if (err.code === 11000) return null;  // duplicate key
            throw err;
        }
    }

    /**
     * INSERT multiple documents.
     * @param {object[]} rows
     */
    static async createMany(rows) {
        return Promise.all(rows.map(r => this.create(r)));
    }

    /**
     * Find first document matching `conditions`, or create it.
     * @param {object} conditions
     * @param {object} [data={}]
     */
    static async firstOrCreate(conditions, data = {}) {
        let inst = await this.findOne(conditions);
        if (!inst) inst = await this.create({ ...conditions, ...data });
        return inst;
    }

    /**
     * Find first document matching `conditions`, update it, or create it.
     * @param {object} conditions
     * @param {object} data
     */
    static async updateOrCreate(conditions, data) {
        const MongooseModel = this._mongooseModel();
        const doc = await MongooseModel.findOneAndUpdate(
            conditions,
            { $set: data },
            { upsert: true, new: true, runValidators: true }
        ).lean().exec();
        const inst = new this();
        Object.assign(inst, doc);
        inst._exists   = true;
        inst._original = { ...doc };
        return inst;
    }

    /**
     * Low-level insert — returns raw Mongoose document.
     * @param {object} data
     */
    static async insert(data) {
        const MongooseModel = this._mongooseModel();
        return MongooseModel.create(data);
    }

    /**
     * Low-level insertMany.
     * @param {object[]} rows
     */
    static async insertMany(rows) {
        const MongooseModel = this._mongooseModel();
        return MongooseModel.insertMany(rows);
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    /**
     * UPDATE a single document by primary key.
     * @param {*}      id
     * @param {object} data
     */
    static async update(id, data) {
        const MongooseModel = this._mongooseModel();
        return MongooseModel.findByIdAndUpdate(
            _castId(id),
            { $set: data },
            { new: true, runValidators: true }
        ).lean().exec();
    }

    /**
     * UPDATE multiple documents by primary key.
     * @param {Array<[id, object]>} pairs
     */
    static async updateMany(pairs) {
        return Promise.all(pairs.map(([id, data]) => this.update(id, data)));
    }

    /**
     * UPDATE all documents matching conditions object.
     * @param {object} conditions
     * @param {object} data
     */
    static async updateWhere(conditions, data) {
        let qb = this._qb();
        for (const [k, v] of Object.entries(conditions)) qb.where(k, v);
        return qb.updateWhere(data);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    /**
     * DELETE a document by primary key.
     * @param {*} id
     */
    static async delete(id) {
        const MongooseModel = this._mongooseModel();
        return MongooseModel.findByIdAndDelete(_castId(id)).exec();
    }

    /**
     * DELETE multiple documents by primary key.
     * @param {*[]} ids
     */
    static async deleteMany(ids) {
        return Promise.all(ids.map(id => this.delete(id)));
    }

    /**
     * DELETE all documents matching conditions.
     * @param {object} conditions
     */
    static async deleteWhere(conditions) {
        let qb = this._qb();
        for (const [k, v] of Object.entries(conditions)) qb.where(k, v);
        return qb.deleteWhere();
    }

    /** Alias for delete */
    static destroy(id) { return this.delete(id); }

    /** Delete all documents in the collection. */
    static async truncate() {
        const MongooseModel = this._mongooseModel();
        return MongooseModel.deleteMany({}).exec();
    }

    // ─── MIGRATE / SEED ───────────────────────────────────────────────────────

    /**
     * Migrate — ensures indexes are synced for this model's schema.
     * Equivalent to running ensureIndexes().
     */
    static async migrate() {
        try {
            const MongooseModel = this._mongooseModel();
            await MongooseModel.ensureIndexes();
            return { is_error: false, message: `✔ Indexes synced for "${this.modelName || this.name}".` };
        } catch (err) {
            return { is_error: true, message: `❗ Migration failed: ${err.message}` };
        }
    }

    /**
     * Rollback migration — drops all indexes except _id.
     */
    static async rollbackMigration() {
        try {
            const MongooseModel = this._mongooseModel();
            await MongooseModel.collection.dropIndexes();
            return { is_error: false, message: `✔ Indexes dropped for "${this.modelName || this.name}".` };
        } catch (err) {
            return { is_error: true, message: `❗ Rollback failed: ${err.message}` };
        }
    }

    /**
     * Seed the collection with an array of documents.
     * Uses createOrIgnore so running twice is safe.
     * @param {object[]} rows
     */
    static async seed(rows) {
        const results = await Promise.allSettled(rows.map(r => this.createOrIgnore(r)));
        const inserted = results.filter(r => r.status === 'fulfilled' && r.value).length;
        const skipped  = results.length - inserted;
        return { is_error: false, message: `✔ Seeded ${inserted} documents. ${skipped} skipped.` };
    }

    // ─── INSTANCE METHODS ─────────────────────────────────────────────────────

    /**
     * Save this instance — INSERT if new, UPDATE if existing.
     */
    async save() {
        const pk   = this.constructor.primaryKey;
        const data = this._toData();

        if (this._exists) {
            const MongooseModel = this.constructor._mongooseModel();
            const doc = await MongooseModel.findByIdAndUpdate(
                _castId(this[pk]),
                { $set: data },
                { new: true, runValidators: true }
            ).lean().exec();
            if (doc) Object.assign(this._original, doc);
            return doc;
        } else {
            const MongooseModel = this.constructor._mongooseModel();
            const doc = await MongooseModel.create(data);
            const obj = doc.toObject();
            Object.assign(this, obj);
            this._exists   = true;
            this._original = obj;
            return doc;
        }
    }

    /**
     * Update this instance with new data and persist.
     * @param {object} data
     */
    async update(data) {
        Object.assign(this, data);
        return this.save();
    }

    /**
     * Delete this instance from the database.
     */
    async delete() {
        const pk = this.constructor.primaryKey;
        const result = await this.constructor.delete(this[pk]);
        this._exists = false;
        return result;
    }

    /**
     * Reload this instance from the database.
     */
    async refresh() {
        const pk    = this.constructor.primaryKey;
        const fresh = await this.constructor.find(this[pk]);
        if (!fresh) throw new Error(`${this.constructor.name}: record no longer exists`);
        Object.assign(this, fresh);
        this._original = { ...fresh._original };
        return this;
    }

    /** Alias for refresh */
    async reload() { return this.refresh(); }

    /**
     * Increment a field on this instance.
     * @param {string} field
     * @param {number} [amount=1]
     */
    async increment(field, amount = 1) {
        const pk = this.constructor.primaryKey;
        const MongooseModel = this.constructor._mongooseModel();
        await MongooseModel.updateOne(
            { [pk]: _castId(this[pk]) },
            { $inc: { [field]: amount } }
        ).exec();
        this[field] = (this[field] || 0) + amount;
        return this;
    }

    /**
     * Decrement a field on this instance.
     * @param {string} field
     * @param {number} [amount=1]
     */
    async decrement(field, amount = 1) {
        return this.increment(field, -amount);
    }

    /** Serialize to plain object (strips _ internals). */
    toJSON() {
        const obj = {};
        for (const k of Object.keys(this)) {
            if (!k.startsWith('_')) obj[k] = this[k];
        }
        // Always include _id
        if (this._id !== undefined) obj._id = this._id;
        return obj;
    }

    /** Serialize to array of [key, value] pairs. */
    toArray() {
        return Object.entries(this.toJSON());
    }

    // ─── RELATIONS ────────────────────────────────────────────────────────────

    /**
     * belongsTo — this document holds a FK referencing a parent.
     *
     * @param {typeof MongoModel} RelatedModel
     * @param {string} [foreignKey]  - field on this document (default: relatedModel_id)
     * @param {string} [ownerKey]    - field on parent (default: _id)
     *
     * @example
     * // Post instance:
     * async author() { return this.belongsTo(User, 'userId'); }
     */
    async belongsTo(RelatedModel, foreignKey, ownerKey = '_id') {
        const fk = foreignKey || `${RelatedModel.modelName.toLowerCase()}Id`;
        return RelatedModel.where(ownerKey, this[fk]).first();
    }

    /**
     * hasOne — this model's PK is referenced by a FK on the related document.
     *
     * @param {typeof MongoModel} RelatedModel
     * @param {string} [foreignKey]  - field on related document
     * @param {string} [localKey]
     */
    async hasOne(RelatedModel, foreignKey, localKey) {
        const lk = localKey || this.constructor.primaryKey;
        const fk = foreignKey || `${this.constructor.modelName.toLowerCase()}Id`;
        return RelatedModel.where(fk, this[lk]).first();
    }

    /**
     * hasMany — returns all related documents.
     *
     * @param {typeof MongoModel} RelatedModel
     * @param {string} [foreignKey]
     * @param {string} [localKey]
     */
    async hasMany(RelatedModel, foreignKey, localKey) {
        const lk = localKey || this.constructor.primaryKey;
        const fk = foreignKey || `${this.constructor.modelName.toLowerCase()}Id`;
        return RelatedModel.where(fk, this[lk]).get();
    }

    /**
     * belongsToMany — many-to-many.
     * In MongoDB this is typically stored as an array of IDs on one side.
     *
     * @param {typeof MongoModel} RelatedModel
     * @param {string} localArrayField  - field on this document holding array of related IDs
     */
    async belongsToMany(RelatedModel, localArrayField) {
        const ids = this[localArrayField] || [];
        if (!ids.length) return [];
        return RelatedModel.whereIn('_id', ids.map(_castId)).get();
    }

    /**
     * Attach IDs to a local array field (push unique values).
     * @param {string} arrayField
     * @param {*[]}    ids
     */
    async attach(arrayField, ids) {
        const pk = this.constructor.primaryKey;
        const MongooseModel = this.constructor._mongooseModel();
        await MongooseModel.updateOne(
            { [pk]: _castId(this[pk]) },
            { $addToSet: { [arrayField]: { $each: ids.map(_castId) } } }
        ).exec();
        this[arrayField] = [...new Set([...(this[arrayField] || []), ...ids])];
        return this;
    }

    /**
     * Detach IDs from a local array field.
     * @param {string} arrayField
     * @param {*[]}    [ids]  - if omitted, clears entire array
     */
    async detach(arrayField, ids) {
        const pk = this.constructor.primaryKey;
        const MongooseModel = this.constructor._mongooseModel();
        if (!ids || !ids.length) {
            await MongooseModel.updateOne(
                { [pk]: _castId(this[pk]) },
                { $set: { [arrayField]: [] } }
            ).exec();
            this[arrayField] = [];
        } else {
            const castIds = ids.map(_castId);
            await MongooseModel.updateOne(
                { [pk]: _castId(this[pk]) },
                { $pull: { [arrayField]: { $in: castIds } } }
            ).exec();
            this[arrayField] = (this[arrayField] || []).filter(id => !castIds.some(c => c.toString() === id.toString()));
        }
        return this;
    }

    /**
     * Sync array field — replaces it entirely with the given IDs.
     * @param {string} arrayField
     * @param {*[]}    ids
     */
    async sync(arrayField, ids) {
        const pk = this.constructor.primaryKey;
        const MongooseModel = this.constructor._mongooseModel();
        const castIds = ids.map(_castId);
        await MongooseModel.updateOne(
            { [pk]: _castId(this[pk]) },
            { $set: { [arrayField]: castIds } }
        ).exec();
        this[arrayField] = castIds;
        return this;
    }

    // ─── EAGER / LAZY LOAD ────────────────────────────────────────────────────

    /**
     * Eagerly load a relation method and attach result as property.
     * @param {string} relation  - Method name on this instance
     */
    async eagerLoad(relation) {
        this[relation] = await this[relation]();
        return this;
    }

    /**
     * Lazily load a relation (alias for eagerLoad).
     * @param {string} relation
     */
    async lazyLoad(relation) {
        return this.eagerLoad(relation);
    }
}

module.exports = { MongoModel, QueryBuilder };