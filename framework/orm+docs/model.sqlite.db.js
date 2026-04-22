'use strict';

const { Database } = require('./database');

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * QueryBuilder
 *
 * Chainable query builder that compiles to SQL and executes via Database.
 * Every Model method returns a QueryBuilder so calls can be chained freely.
 *
 * @example
 * const users = await User.where('active', 1).orderBy('name').limit(10).get();
 */
class QueryBuilder {

    /**
     * @param {typeof Model} model  - The Model subclass this builder is bound to
     */
    constructor(model) {
        this._model       = model;
        this._table       = model.table;
        this._pk          = model.primaryKey;

        // SELECT
        this._selects     = [];          // string[]
        this._distinct    = false;

        // WHERE
        this._wheres      = [];          // { sql, bindings }[]

        // JOIN
        this._joins       = [];          // string[]

        // ORDER / GROUP / HAVING
        this._orders      = [];          // string[]
        this._groups      = [];          // string[]
        this._havings     = [];          // string[]

        // LIMIT / OFFSET
        this._limit       = null;
        this._offset      = null;

        // EAGER LOADS
        this._withs       = [];          // string[]
        this._withCounts  = [];          // string[]

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

    _buildSelect() {
        if (this._selects.length === 0) return `"${this._table}".*`;
        return this._selects.join(', ');
    }

    _buildWhere() {
        if (this._wheres.length === 0) return { sql: '', bindings: [] };
        const parts    = [];
        const bindings = [];
        for (const w of this._wheres) {
            parts.push(w.sql);
            bindings.push(...w.bindings);
        }
        return { sql: ' WHERE ' + parts.join(' '), bindings };
    }

    _buildOrder()  { return this._orders.length  ? ' ORDER BY '  + this._orders.join(', ')  : ''; }
    _buildGroup()  { return this._groups.length  ? ' GROUP BY '  + this._groups.join(', ')  : ''; }
    _buildHaving() { return this._havings.length ? ' HAVING '    + this._havings.join(' AND ') : ''; }
    _buildLimit()  { return this._limit  !== null ? ` LIMIT ${this._limit}`   : ''; }
    _buildOffset() { return this._offset !== null ? ` OFFSET ${this._offset}` : ''; }
    _buildJoins()  { return this._joins.length   ? ' ' + this._joins.join(' ') : ''; }

    _compile() {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere();
        const distinct = this._distinct ? 'DISTINCT ' : '';
        const sql =
            `SELECT ${distinct}${this._buildSelect()} FROM "${this._table}"` +
            this._buildJoins() +
            whereSql +
            this._buildGroup() +
            this._buildHaving() +
            this._buildOrder() +
            this._buildLimit() +
            this._buildOffset();
        return { sql, bindings };
    }

    _compileCount(expr = '*') {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere();
        const sql =
            `SELECT COUNT(${expr}) as aggregate FROM "${this._table}"` +
            this._buildJoins() +
            whereSql +
            this._buildGroup() +
            this._buildHaving();
        return { sql, bindings };
    }

    _compileAggregate(fn, col) {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere();
        const sql =
            `SELECT ${fn}("${col}") as aggregate FROM "${this._table}"` +
            this._buildJoins() +
            whereSql;
        return { sql, bindings };
    }

    async _exec(sql, bindings = []) {
        return Database.query(sql, bindings);
    }

    _hydrate(rows) {
        return rows.map(row => {
            const inst = new this._model();
            Object.assign(inst, row);
            inst._exists = true;
            inst._original = { ...row };
            return inst;
        });
    }

    async _eagerLoad(instances) {
        for (const rel of this._withs) {
            const fn = this._model.prototype[rel];
            if (typeof fn !== 'function') continue;
            for (const inst of instances) await fn.call(inst, true);
        }
        for (const rel of this._withCounts) {
            const fn = this._model.prototype[rel];
            if (typeof fn !== 'function') continue;
            for (const inst of instances) {
                const result = await fn.call(inst, false, true);
                inst[`${rel}_count`] = result;
            }
        }
        return instances;
    }

    // ─── SELECT ───────────────────────────────────────────────────────────────

    /** SELECT specific columns. Accepts column names or raw expressions. */
    select(...cols) {
        this._selects.push(...cols.flat().map(c => c.includes('(') ? c : `"${this._table}"."${c}"`));
        return this;
    }

    /** Add DISTINCT to the SELECT */
    distinct() {
        this._distinct = true;
        return this;
    }

    // ─── WHERE ────────────────────────────────────────────────────────────────

    _pushWhere(connector, sql, bindings = []) {
        if (this._wheres.length === 0) {
            this._wheres.push({ sql, bindings });
        } else {
            this._wheres.push({ sql: `${connector} ${sql}`, bindings });
        }
        return this;
    }

    /** WHERE col = value */
    where(col, value) {
        return this._pushWhere('AND', `"${this._table}"."${col}" = ?`, [value]);
    }

    /** WHERE col <op> value  (op: =, !=, <, >, <=, >=, LIKE, …) */
    whereOp(col, op, value) {
        return this._pushWhere('AND', `"${this._table}"."${col}" ${op} ?`, [value]);
    }

    /** OR WHERE col = value */
    orWhere(col, value) {
        return this._pushWhere('OR', `"${this._table}"."${col}" = ?`, [value]);
    }

    /** OR WHERE col <op> value */
    orWhereOp(col, op, value) {
        return this._pushWhere('OR', `"${this._table}"."${col}" ${op} ?`, [value]);
    }

    /** AND WHERE col = value  (alias for where) */
    andWhere(col, value) {
        return this.where(col, value);
    }

    /** WHERE col IN (...values) */
    whereIn(col, values) {
        if (!values.length) return this._pushWhere('AND', '0 = 1', []);
        const placeholders = values.map(() => '?').join(', ');
        return this._pushWhere('AND', `"${this._table}"."${col}" IN (${placeholders})`, values);
    }

    /** WHERE col NOT IN (...values) */
    whereNotIn(col, values) {
        if (!values.length) return this;
        const placeholders = values.map(() => '?').join(', ');
        return this._pushWhere('AND', `"${this._table}"."${col}" NOT IN (${placeholders})`, values);
    }

    /** WHERE col IS NULL */
    whereNull(col) {
        return this._pushWhere('AND', `"${this._table}"."${col}" IS NULL`, []);
    }

    /** WHERE col IS NOT NULL */
    whereNotNull(col) {
        return this._pushWhere('AND', `"${this._table}"."${col}" IS NOT NULL`, []);
    }

    /** WHERE col BETWEEN min AND max */
    whereBetween(col, min, max) {
        return this._pushWhere('AND', `"${this._table}"."${col}" BETWEEN ? AND ?`, [min, max]);
    }

    /** WHERE col NOT BETWEEN min AND max */
    whereNotBetween(col, min, max) {
        return this._pushWhere('AND', `"${this._table}"."${col}" NOT BETWEEN ? AND ?`, [min, max]);
    }

    /** WHERE col LIKE pattern */
    whereLike(col, pattern) {
        return this._pushWhere('AND', `"${this._table}"."${col}" LIKE ?`, [pattern]);
    }

    /** WHERE col LIKE pattern  (case-insensitive via LOWER) */
    whereILike(col, pattern) {
        return this._pushWhere('AND', `LOWER("${this._table}"."${col}") LIKE LOWER(?)`, [pattern]);
    }

    /** Raw WHERE fragment — you handle escaping */
    whereRaw(sql, bindings = []) {
        return this._pushWhere('AND', sql, bindings);
    }

    // ─── JOIN ─────────────────────────────────────────────────────────────────

    _addJoin(type, table, localCol, op, foreignCol) {
        this._joins.push(`${type} JOIN "${table}" ON "${this._table}"."${localCol}" ${op} "${table}"."${foreignCol}"`);
        return this;
    }

    join(table, localCol, op, foreignCol)      { return this._addJoin('INNER', table, localCol, op, foreignCol); }
    leftJoin(table, localCol, op, foreignCol)  { return this._addJoin('LEFT',  table, localCol, op, foreignCol); }
    rightJoin(table, localCol, op, foreignCol) { return this._addJoin('LEFT',  table, localCol, op, foreignCol); } // SQLite has no RIGHT JOIN, emulated
    innerJoin(table, localCol, op, foreignCol) { return this._addJoin('INNER', table, localCol, op, foreignCol); }
    outerJoin(table, localCol, op, foreignCol) { return this._addJoin('LEFT',  table, localCol, op, foreignCol); }
    fullJoin(table, localCol, op, foreignCol)  { return this._addJoin('LEFT',  table, localCol, op, foreignCol); } // SQLite has no FULL JOIN, emulated

    /** Raw JOIN fragment */
    joinRaw(sql) {
        this._joins.push(sql);
        return this;
    }

    // ─── ORDER ────────────────────────────────────────────────────────────────

    /** ORDER BY col ASC */
    orderBy(col, dir = 'ASC') {
        this._orders.push(`"${this._table}"."${col}" ${dir.toUpperCase()}`);
        return this;
    }

    /** ORDER BY col DESC */
    orderByDesc(col) {
        return this.orderBy(col, 'DESC');
    }

    /** Raw ORDER BY fragment */
    orderByRaw(sql) {
        this._orders.push(sql);
        return this;
    }

    // ─── GROUP / HAVING ───────────────────────────────────────────────────────

    groupBy(col) {
        this._groups.push(`"${this._table}"."${col}"`);
        return this;
    }

    groupByRaw(sql) {
        this._groups.push(sql);
        return this;
    }

    having(sql, bindings = []) {
        this._havings.push(sql);
        if (bindings.length) {
            // Attach bindings to last where entry — they come after WHERE bindings in _buildWhere
            // Instead store in _havingBindings
            this._havingBindings = (this._havingBindings || []).concat(bindings);
        }
        return this;
    }

    // ─── LIMIT / OFFSET ───────────────────────────────────────────────────────

    limit(n) {
        this._limit = n;
        return this;
    }

    offset(n) {
        this._offset = n;
        return this;
    }

    // ─── EAGER LOAD ───────────────────────────────────────────────────────────

    /** Eager-load named relations */
    with(...relations) {
        this._withs.push(...relations.flat());
        return this;
    }

    /** Eager-load relation counts */
    withCount(...relations) {
        this._withCounts.push(...relations.flat());
        return this;
    }

    // ─── FETCH METHODS ────────────────────────────────────────────────────────

    /**
     * Execute and return all matching rows as Model instances.
     * @returns {Promise<Model[]>}
     */
    async get() {
        const { sql, bindings } = this._compile();
        const result = await this._exec(sql, bindings);
        if (result.is_error) return [];
        const instances = this._hydrate(result.data);
        if (this._withs.length || this._withCounts.length) await this._eagerLoad(instances);
        return instances;
    }

    /**
     * Return only the first result or null.
     * @returns {Promise<Model|null>}
     */
    async first() {
        this._limit = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /**
     * Return the last row by primary key.
     * @returns {Promise<Model|null>}
     */
    async last() {
        this.orderByDesc(this._pk);
        this._limit = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /**
     * Find by primary key. Returns Model instance or null.
     * @param {*} id
     * @returns {Promise<Model|null>}
     */
    async find(id) {
        return this.where(this._pk, id).first();
    }

    /**
     * Find by primary key, throws if not found.
     * @param {*} id
     */
    async findOrFail(id) {
        const row = await this.find(id);
        if (!row) throw new Error(`${this._model.name}: No record found for id=${id}`);
        return row;
    }

    /**
     * Find the first row matching the given column/value pair.
     * @param {string} col
     * @param {*} value
     */
    async findBy(col, value) {
        return this.where(col, value).first();
    }

    /**
     * Find one row by where conditions (object shorthand).
     * @param {object} conditions
     */
    async findOne(conditions = {}) {
        for (const [k, v] of Object.entries(conditions)) this.where(k, v);
        return this.first();
    }

    /**
     * Find all rows matching a column/value pair.
     * @param {string} col
     * @param {*} value
     */
    async findAll(col, value) {
        return this.where(col, value).get();
    }

    /**
     * Return all rows (no additional filters applied).
     * @returns {Promise<Model[]>}
     */
    async all() {
        return this.get();
    }

    // ─── PLUCK / CHUNK / KEY-BY ───────────────────────────────────────────────

    /**
     * Return a flat array of values for a single column.
     * @param {string} col
     */
    async pluck(col) {
        this._selects = [`"${this._table}"."${col}"`];
        const { sql, bindings } = this._compile();
        const result = await this._exec(sql, bindings);
        if (result.is_error) return [];
        return result.data.map(r => r[col]);
    }

    /**
     * Return rows as an object keyed by the given column.
     * @param {string} col
     */
    async keyBy(col) {
        const rows = await this.get();
        return Object.fromEntries(rows.map(r => [r[col], r]));
    }

    /**
     * Process results in chunks to avoid loading huge result sets into memory.
     * @param {number}   size
     * @param {Function} callback  - receives Model[] chunk
     */
    async chunk(size, callback) {
        let page = 0;
        while (true) {
            const clone = this._clone();
            clone._limit  = size;
            clone._offset = page * size;
            const rows = await clone.get();
            if (!rows.length) break;
            await callback(rows);
            if (rows.length < size) break;
            page++;
        }
    }

    /**
     * Paginate results.
     * @param {number} page    - 1-based page number
     * @param {number} perPage - rows per page (default 15)
     * @returns {Promise<{ data: Model[], total: number, per_page: number, current_page: number, last_page: number, from: number, to: number }>}
     */
    async paginate(page = 1, perPage = 15) {
        const countClone = this._clone();
        const { sql: cSql, bindings: cBindings } = countClone._compileCount();
        const cResult = await this._exec(cSql, cBindings);
        const total   = cResult.is_error ? 0 : (cResult.data[0]?.aggregate ?? 0);

        this._limit  = perPage;
        this._offset = (page - 1) * perPage;
        const data   = await this.get();

        return {
            data,
            total,
            per_page:     perPage,
            current_page: page,
            last_page:    Math.ceil(total / perPage) || 1,
            from:         total ? this._offset + 1 : 0,
            to:           Math.min(this._offset + perPage, total),
        };
    }

    // ─── AGGREGATES ───────────────────────────────────────────────────────────

    async count(col = '*') {
        const { sql, bindings } = this._compileCount(col === '*' ? '*' : `"${col}"`);
        const result = await this._exec(sql, bindings);
        return result.is_error ? 0 : (result.data[0]?.aggregate ?? 0);
    }

    async sum(col) {
        const { sql, bindings } = this._compileAggregate('SUM', col);
        const result = await this._exec(sql, bindings);
        return result.is_error ? null : (result.data[0]?.aggregate ?? null);
    }

    async avg(col) {
        const { sql, bindings } = this._compileAggregate('AVG', col);
        const result = await this._exec(sql, bindings);
        return result.is_error ? null : (result.data[0]?.aggregate ?? null);
    }

    async min(col) {
        const { sql, bindings } = this._compileAggregate('MIN', col);
        const result = await this._exec(sql, bindings);
        return result.is_error ? null : (result.data[0]?.aggregate ?? null);
    }

    async max(col) {
        const { sql, bindings } = this._compileAggregate('MAX', col);
        const result = await this._exec(sql, bindings);
        return result.is_error ? null : (result.data[0]?.aggregate ?? null);
    }

    /** Returns true if any row matches the current query. */
    async exists() {
        return (await this.count()) > 0;
    }

    /** Returns true if NO rows match the current query. */
    async doesntExist() {
        return !(await this.exists());
    }

    // ─── UPDATE / DELETE ──────────────────────────────────────────────────────

    /**
     * UPDATE rows matching current WHERE with given data object.
     * @param {object} data
     */
    async updateWhere(data) {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings: whereBindings } = this._buildWhere();
        const sets    = Object.keys(data).map(k => `"${k}" = ?`).join(', ');
        const vals    = Object.values(data);
        const sql     = `UPDATE "${this._table}" SET ${sets}${whereSql}`;
        return this._exec(sql, [...vals, ...whereBindings]);
    }

    /**
     * DELETE rows matching the current WHERE.
     */
    async deleteWhere() {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere();
        const sql = `DELETE FROM "${this._table}"${whereSql}`;
        return this._exec(sql, bindings);
    }

    // ─── INCREMENT / DECREMENT ────────────────────────────────────────────────

    /** Increment a column by `amount` for all matching rows. */
    async increment(col, amount = 1) {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere();
        const sql = `UPDATE "${this._table}" SET "${col}" = "${col}" + ?${whereSql}`;
        return this._exec(sql, [amount, ...bindings]);
    }

    /** Decrement a column by `amount` for all matching rows. */
    async decrement(col, amount = 1) {
        return this.increment(col, -amount);
    }

    // ─── RAW ──────────────────────────────────────────────────────────────────

    /** Execute a completely raw SQL string. */
    async raw(sql, bindings = []) {
        return this._exec(sql, bindings);
    }

    // ─── INTERNAL UTILS ───────────────────────────────────────────────────────

    /** Shallow-clone this builder (used by paginate / chunk). */
    _clone() {
        const c = new QueryBuilder(this._model);
        c._selects   = [...this._selects];
        c._distinct  = this._distinct;
        c._wheres    = this._wheres.map(w => ({ ...w, bindings: [...w.bindings] }));
        c._joins     = [...this._joins];
        c._orders    = [...this._orders];
        c._groups    = [...this._groups];
        c._havings   = [...this._havings];
        c._limit     = this._limit;
        c._offset    = this._offset;
        c._withs     = [...this._withs];
        c._withCounts= [...this._withCounts];
        c._scopesApplied = this._scopesApplied;
        return c;
    }
}

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * Model
 *
 * Base class for all ORM models.
 *
 * @example
 * class User extends Model {
 *     static table      = 'users';
 *     static primaryKey = 'id';
 *
 *     // Optional: define fillable columns
 *     static fillable = ['name', 'email', 'active'];
 *
 *     // Relations
 *     async posts(eager = false) {
 *         return Post.where('user_id', this.id).get();
 *     }
 * }
 */
class Model extends Database {

    // ── Subclass overrides ────────────────────────────────────────────────────

    /** @type {string} Table name — override in subclass */
    static table = '';

    /** @type {string} Primary key column name */
    static primaryKey = 'id';

    /** @type {string[]} Columns that can be mass-assigned */
    static fillable = [];

    /** @type {string[]} Columns excluded from mass assignment */
    static guarded = [];

    /** @type {object} Named local scopes: { scopeName: (qb) => qb } */
    static scopes = {};

    /** @type {object} Named global scopes applied to every query */
    static _globalScopes = {};

    // ── Instance state ────────────────────────────────────────────────────────

    constructor(attributes = {}) {
        super();
        this._exists   = false;
        this._original = {};
        if (Object.keys(attributes).length) this._fill(attributes);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

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

    static _qb() {
        return new QueryBuilder(this);
    }

    // ─── Static query entry points ────────────────────────────────────────────

    static where(col, value)        { return this._qb().where(col, value); }
    static whereOp(col, op, value)  { return this._qb().whereOp(col, op, value); }
    static orWhere(col, value)      { return this._qb().orWhere(col, value); }
    static whereIn(col, values)     { return this._qb().whereIn(col, values); }
    static whereNotIn(col, values)  { return this._qb().whereNotIn(col, values); }
    static whereNull(col)           { return this._qb().whereNull(col); }
    static whereNotNull(col)        { return this._qb().whereNotNull(col); }
    static whereBetween(col, a, b)  { return this._qb().whereBetween(col, a, b); }
    static whereNotBetween(col,a,b) { return this._qb().whereNotBetween(col, a, b); }
    static whereLike(col, p)        { return this._qb().whereLike(col, p); }
    static whereILike(col, p)       { return this._qb().whereILike(col, p); }
    static whereRaw(sql, b = [])    { return this._qb().whereRaw(sql, b); }
    static select(...cols)          { return this._qb().select(...cols); }
    static distinct()               { return this._qb().distinct(); }
    static orderBy(col, dir)        { return this._qb().orderBy(col, dir); }
    static orderByDesc(col)         { return this._qb().orderByDesc(col); }
    static orderByRaw(sql)          { return this._qb().orderByRaw(sql); }
    static groupBy(col)             { return this._qb().groupBy(col); }
    static groupByRaw(sql)          { return this._qb().groupByRaw(sql); }
    static having(sql, b)           { return this._qb().having(sql, b); }
    static limit(n)                 { return this._qb().limit(n); }
    static offset(n)                { return this._qb().offset(n); }
    static join(t, l, op, f)        { return this._qb().join(t, l, op, f); }
    static leftJoin(t, l, op, f)    { return this._qb().leftJoin(t, l, op, f); }
    static innerJoin(t, l, op, f)   { return this._qb().innerJoin(t, l, op, f); }
    static joinRaw(sql)             { return this._qb().joinRaw(sql); }
    static with(...r)               { return this._qb().with(...r); }
    static withCount(...r)          { return this._qb().withCount(...r); }
    static pluck(col)               { return this._qb().pluck(col); }
    static keyBy(col)               { return this._qb().keyBy(col); }
    static chunk(size, cb)          { return this._qb().chunk(size, cb); }
    static increment(col, amt)      { return this._qb().increment(col, amt); }
    static decrement(col, amt)      { return this._qb().decrement(col, amt); }
    static count(col)               { return this._qb().count(col); }
    static sum(col)                 { return this._qb().sum(col); }
    static avg(col)                 { return this._qb().avg(col); }
    static min(col)                 { return this._qb().min(col); }
    static max(col)                 { return this._qb().max(col); }
    static exists()                 { return this._qb().exists(); }
    static doesntExist()            { return this._qb().doesntExist(); }

    /**
     * Apply a named local scope to the query.
     * @param {string} name
     * @param  {...any} args
     */
    static scope(name, ...args) {
        const fn = this.scopes[name];
        if (!fn) throw new Error(`Scope "${name}" not defined on ${this.name}`);
        const qb = this._qb();
        fn(qb, ...args);
        return qb;
    }

    /**
     * Register a global scope (applied to every query).
     * @param {string}   name
     * @param {Function} fn   - receives QueryBuilder
     */
    static globalScope(name, fn) {
        this._globalScopes = { ...this._globalScopes, [name]: fn };
    }

    // ─── FIND ─────────────────────────────────────────────────────────────────

    /** Find by primary key. Returns instance or null. */
    static find(id)               { return this._qb().find(id); }

    /** Find by primary key. Throws if not found. */
    static findOrFail(id)         { return this._qb().findOrFail(id); }

    /** Find by column/value pair. */
    static findBy(col, value)     { return this._qb().findBy(col, value); }

    /** Find one row by conditions object. */
    static findOne(conditions)    { return this._qb().findOne(conditions); }

    /** Find all rows matching a column/value pair. */
    static findAll(col, value)    { return this._qb().findAll(col, value); }

    /** Return all rows. */
    static all()                  { return this._qb().all(); }

    /** Return first row. */
    static first()                { return this._qb().first(); }

    /** Return last row (by PK desc). */
    static last()                 { return this._qb().last(); }

    /** Return all rows (alias for all). */
    static get()                  { return this._qb().get(); }

    /** Paginate. */
    static paginate(page, perPage){ return this._qb().paginate(page, perPage); }

    // ─── INSERT / CREATE ──────────────────────────────────────────────────────

    /**
     * INSERT a single row and return the new Model instance.
     * @param {object} data
     */
    static async create(data) {
        const result = await this.insert(data);
        if (result.is_error) throw new Error(result.message);
        return this.find(result.data.lastID);
    }

    /**
     * INSERT OR IGNORE a single row (silently ignores unique constraint violations).
     * @param {object} data
     */
    static async createOrIgnore(data) {
        const cols = Object.keys(data);
        const vals = Object.values(data);
        const sql  = `INSERT OR IGNORE INTO "${this.table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
        return Database.query(sql, vals);
    }

    /**
     * INSERT multiple rows. Returns array of results.
     * @param {object[]} rows
     */
    static async createMany(rows) {
        return Promise.all(rows.map(r => this.create(r)));
    }

    /**
     * Find the first row matching `conditions`, or create it with `data`.
     * @param {object} conditions  - WHERE conditions used to search
     * @param {object} [data={}]   - Extra data merged on create
     */
    static async firstOrCreate(conditions, data = {}) {
        let inst = await this.findOne(conditions);
        if (!inst) inst = await this.create({ ...conditions, ...data });
        return inst;
    }

    /**
     * Find first row matching `conditions`, update it with `data`, or create it.
     * @param {object} conditions
     * @param {object} data
     */
    static async updateOrCreate(conditions, data) {
        let inst = await this.findOne(conditions);
        if (inst) {
            await inst.update(data);
            await inst.refresh();
        } else {
            inst = await this.create({ ...conditions, ...data });
        }
        return inst;
    }

    /**
     * Low-level INSERT — returns raw Database result.
     * @param {object} data
     */
    static async insert(data) {
        const cols = Object.keys(data);
        const vals = Object.values(data);
        const sql  = `INSERT INTO "${this.table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
        return Database.query(sql, vals);
    }

    /**
     * Low-level INSERT for multiple rows.
     * @param {object[]} rows
     */
    static async insertMany(rows) {
        return Promise.all(rows.map(r => this.insert(r)));
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    /**
     * UPDATE a single row by primary key.
     * @param {*}      id
     * @param {object} data
     */
    static async update(id, data) {
        const sets    = Object.keys(data).map(k => `"${k}" = ?`).join(', ');
        const vals    = [...Object.values(data), id];
        const sql     = `UPDATE "${this.table}" SET ${sets} WHERE "${this.primaryKey}" = ?`;
        return Database.query(sql, vals);
    }

    /**
     * UPDATE multiple rows by primary key.
     * @param {Array<[id, object]>} pairs  - [ [id, data], … ]
     */
    static async updateMany(pairs) {
        return Promise.all(pairs.map(([id, data]) => this.update(id, data)));
    }

    /**
     * UPDATE all rows matching conditions.
     * @param {object} conditions  - { col: value, … }
     * @param {object} data
     */
    static async updateWhere(conditions, data) {
        let qb = this._qb();
        for (const [k, v] of Object.entries(conditions)) qb.where(k, v);
        return qb.updateWhere(data);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    /**
     * DELETE a row by primary key.
     * @param {*} id
     */
    static async delete(id) {
        const sql = `DELETE FROM "${this.table}" WHERE "${this.primaryKey}" = ?`;
        return Database.query(sql, [id]);
    }

    /**
     * DELETE multiple rows by primary key.
     * @param {*[]} ids
     */
    static async deleteMany(ids) {
        return Promise.all(ids.map(id => this.delete(id)));
    }

    /**
     * DELETE rows matching conditions.
     * @param {object} conditions
     */
    static async deleteWhere(conditions) {
        let qb = this._qb();
        for (const [k, v] of Object.entries(conditions)) qb.where(k, v);
        return qb.deleteWhere();
    }

    /**
     * DELETE by primary key (alias for delete).
     * @param {*} id
     */
    static destroy(id) { return this.delete(id); }

    /**
     * DELETE every row in the table.
     */
    static async truncate() {
        return Database.query(`DELETE FROM "${this.table}"`);
    }

    // ─── RAW ──────────────────────────────────────────────────────────────────

    /** Execute a raw SQL query. */
    static raw(sql, bindings = []) {
        return Database.query(sql, bindings);
    }

    /** Alias for raw. */
    static query(sql, bindings = []) {
        return Database.query(sql, bindings);
    }

    // ─── INSTANCE METHODS ─────────────────────────────────────────────────────

    /**
     * Save this instance — INSERT if new, UPDATE if existing.
     */
    async save() {
        const pk   = this.constructor.primaryKey;
        const data = this._toData();

        if (this._exists) {
            const result = await this.constructor.update(this[pk], data);
            if (!result.is_error) this._original = { ...this._original, ...data };
            return result;
        } else {
            const result = await this.constructor.insert({ ...data });
            if (result.is_error) throw new Error(result.message);
            this[pk]     = result.data.lastID;
            this._exists = true;
            this._original = { ...data, [pk]: this[pk] };
            return result;
        }
    }

    /**
     * UPDATE this instance with new attribute values and persist.
     * @param {object} data
     */
    async update(data) {
        Object.assign(this, data);
        return this.save();
    }

    /**
     * DELETE this instance from the database.
     */
    async delete() {
        const pk = this.constructor.primaryKey;
        const result = await this.constructor.delete(this[pk]);
        this._exists = false;
        return result;
    }

    /**
     * Reload this instance from the database (refresh in-place).
     */
    async refresh() {
        const pk   = this.constructor.primaryKey;
        const fresh = await this.constructor.find(this[pk]);
        if (!fresh) throw new Error(`${this.constructor.name}: record no longer exists`);
        Object.assign(this, fresh);
        this._original = { ...fresh._original };
        return this;
    }

    /** Alias for refresh. */
    async reload() { return this.refresh(); }

    /**
     * INCREMENT a column on this instance.
     * @param {string} col
     * @param {number} [amount=1]
     */
    async increment(col, amount = 1) {
        const pk = this.constructor.primaryKey;
        const result = await this.constructor
            ._qb().where(pk, this[pk]).increment(col, amount);
        if (!result.is_error) this[col] = (this[col] || 0) + amount;
        return result;
    }

    /**
     * DECREMENT a column on this instance.
     * @param {string} col
     * @param {number} [amount=1]
     */
    async decrement(col, amount = 1) {
        return this.increment(col, -amount);
    }

    /** Serialize to plain object. */
    toJSON() {
        const obj = {};
        for (const k of Object.keys(this)) {
            if (!k.startsWith('_')) obj[k] = this[k];
        }
        return obj;
    }

    /** Serialize to plain array of [key, value] pairs. */
    toArray() {
        return Object.entries(this.toJSON());
    }

    // ─── RELATIONS ────────────────────────────────────────────────────────────

    /**
     * belongsTo — this model has a foreign key pointing to parent.
     *
     * @param {typeof Model} RelatedModel
     * @param {string} [foreignKey]   - FK on this table  (default: relatedTable_id)
     * @param {string} [ownerKey]     - PK on related table (default: 'id')
     *
     * @example
     * // In Post model instance:
     * async user() { return this.belongsTo(User); }
     */
    async belongsTo(RelatedModel, foreignKey, ownerKey = 'id') {
        const fk  = foreignKey || `${RelatedModel.table.replace(/s$/, '')}_id`;
        return RelatedModel.where(ownerKey, this[fk]).first();
    }

    /**
     * hasOne — this model's PK is referenced by a FK on the related table.
     *
     * @param {typeof Model} RelatedModel
     * @param {string} [foreignKey]   - FK on related table (default: thisTable_id)
     * @param {string} [localKey]
     */
    async hasOne(RelatedModel, foreignKey, localKey) {
        const lk = localKey || this.constructor.primaryKey;
        const fk = foreignKey || `${this.constructor.table.replace(/s$/, '')}_id`;
        return RelatedModel.where(fk, this[lk]).first();
    }

    /**
     * hasMany — returns all related rows.
     *
     * @param {typeof Model} RelatedModel
     * @param {string} [foreignKey]
     * @param {string} [localKey]
     */
    async hasMany(RelatedModel, foreignKey, localKey) {
        const lk = localKey || this.constructor.primaryKey;
        const fk = foreignKey || `${this.constructor.table.replace(/s$/, '')}_id`;
        return RelatedModel.where(fk, this[lk]).get();
    }

    /**
     * belongsToMany — many-to-many via pivot table.
     *
     * @param {typeof Model} RelatedModel
     * @param {string} pivotTable
     * @param {string} [localFK]    - FK in pivot pointing to this model
     * @param {string} [foreignFK]  - FK in pivot pointing to related model
     */
    async belongsToMany(RelatedModel, pivotTable, localFK, foreignFK) {
        const selfTable = this.constructor.table;
        const lk  = this.constructor.primaryKey;
        const lfk = localFK   || `${selfTable.replace(/s$/, '')}_id`;
        const rfk = foreignFK || `${RelatedModel.table.replace(/s$/, '')}_id`;

        return RelatedModel._qb()
            .joinRaw(`INNER JOIN "${pivotTable}" ON "${pivotTable}"."${rfk}" = "${RelatedModel.table}"."${RelatedModel.primaryKey}"`)
            .whereRaw(`"${pivotTable}"."${lfk}" = ?`, [this[lk]])
            .get();
    }

    /**
     * Attach IDs to a many-to-many pivot table.
     * @param {string}   pivotTable
     * @param {string}   localFK
     * @param {string}   foreignFK
     * @param {*[]}      ids
     * @param {object[]} [extraData=[]]  - Optional extra columns per row
     */
    async attach(pivotTable, localFK, foreignFK, ids, extraData = []) {
        const lk = this.constructor.primaryKey;
        return Promise.all(ids.map((id, i) => {
            const row  = { [localFK]: this[lk], [foreignFK]: id, ...(extraData[i] || {}) };
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const sql  = `INSERT OR IGNORE INTO "${pivotTable}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
            return Database.query(sql, vals);
        }));
    }

    /**
     * Detach IDs from a many-to-many pivot table.
     * @param {string} pivotTable
     * @param {string} localFK
     * @param {string} foreignFK
     * @param {*[]}    [ids]  - If omitted, detaches all
     */
    async detach(pivotTable, localFK, foreignFK, ids) {
        const lk  = this.constructor.primaryKey;
        if (!ids || !ids.length) {
            return Database.query(`DELETE FROM "${pivotTable}" WHERE "${localFK}" = ?`, [this[lk]]);
        }
        const placeholders = ids.map(() => '?').join(', ');
        return Database.query(
            `DELETE FROM "${pivotTable}" WHERE "${localFK}" = ? AND "${foreignFK}" IN (${placeholders})`,
            [this[lk], ...ids]
        );
    }

    /**
     * Sync a pivot table — detaches everything then attaches the given IDs.
     * @param {string} pivotTable
     * @param {string} localFK
     * @param {string} foreignFK
     * @param {*[]}    ids
     * @param {object[]} [extraData=[]]
     */
    async sync(pivotTable, localFK, foreignFK, ids, extraData = []) {
        await this.detach(pivotTable, localFK, foreignFK);
        return this.attach(pivotTable, localFK, foreignFK, ids, extraData);
    }

    // ─── EAGER / LAZY LOAD HELPERS ────────────────────────────────────────────

    /**
     * Eagerly load a relation method and attach its result as a property.
     * @param {string} relation  - Method name on this instance
     */
    async eagerLoad(relation) {
        this[relation] = await this[relation]();
        return this;
    }

    /**
     * Lazily load a relation (same as eagerLoad but semantically lazy).
     * @param {string} relation
     */
    async lazyLoad(relation) {
        return this.eagerLoad(relation);
    }
}


module.exports = { Model, QueryBuilder };