'use strict';

const { Database } = require('./database');

// ─── QueryBuilder ─────────────────────────────────────────────────────────────

/**
 * QueryBuilder
 *
 * Chainable PostgreSQL query builder. Mirrors the SQLite & MongoDB ORM API.
 * Uses $1, $2, … positional placeholders (pg driver standard).
 *
 * @example
 * const users = await User.where('active', true).orderBy('name').limit(10).get();
 */
class QueryBuilder {

    /**
     * @param {typeof PgModel} model
     */
    constructor(model) {
        this._model   = model;
        this._table   = model.table;
        this._pk      = model.primaryKey;
        this._schema  = model.schema || 'public';

        // SELECT
        this._selects  = [];
        this._distinct = false;

        // WHERE
        this._wheres   = [];   // { sql: string, bindings: any[] }[]

        // JOIN
        this._joins    = [];   // raw SQL strings

        // ORDER / GROUP / HAVING
        this._orders   = [];
        this._groups   = [];
        this._havings  = [];   // { sql, bindings }[]

        // LIMIT / OFFSET
        this._limitVal  = null;
        this._offsetVal = null;

        // EAGER LOAD
        this._withs      = [];
        this._withCounts = [];

        // SCOPES
        this._scopesApplied = false;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    _applyGlobalScopes() {
        if (this._scopesApplied) return;
        this._scopesApplied = true;
        for (const fn of Object.values(this._model._globalScopes || {})) fn(this);
    }

    /** Fully-qualified table identifier */
    get _fqt() {
        return this._schema === 'public'
            ? `"${this._table}"`
            : `"${this._schema}"."${this._table}"`;
    }

    _buildSelect() {
        if (!this._selects.length) return `${this._fqt}.*`;
        return this._selects.join(', ');
    }

    /**
     * Collect all WHERE bindings and rewrite ? placeholders → $N (pg-style).
     * Returns { sql, bindings }.
     */
    _buildWhere(startIndex = 1) {
        if (!this._wheres.length) return { sql: '', bindings: [], nextIndex: startIndex };
        const parts    = [];
        const bindings = [];
        let   idx      = startIndex;

        for (const w of this._wheres) {
            // replace each ? with the next $N
            let sql = w.sql;
            const rebound = [];
            for (const b of w.bindings) {
                sql = sql.replace('?', `$${idx++}`);
                rebound.push(b);
            }
            parts.push(sql);
            bindings.push(...rebound);
        }

        return { sql: ' WHERE ' + parts.join(' '), bindings, nextIndex: idx };
    }

    _buildHaving(startIndex) {
        if (!this._havings.length) return { sql: '', bindings: [], nextIndex: startIndex };
        const parts    = [];
        const bindings = [];
        let   idx      = startIndex;

        for (const h of this._havings) {
            let sql = h.sql;
            for (const b of h.bindings) {
                sql = sql.replace('?', `$${idx++}`);
                bindings.push(b);
            }
            parts.push(sql);
        }

        return { sql: ' HAVING ' + parts.join(' AND '), bindings, nextIndex: idx };
    }

    _buildOrder()  { return this._orders.length  ? ' ORDER BY '  + this._orders.join(', ')  : ''; }
    _buildGroup()  { return this._groups.length  ? ' GROUP BY '  + this._groups.join(', ')  : ''; }
    _buildLimit()  { return this._limitVal  !== null ? ` LIMIT ${this._limitVal}`   : ''; }
    _buildOffset() { return this._offsetVal !== null ? ` OFFSET ${this._offsetVal}` : ''; }
    _buildJoins()  { return this._joins.length   ? ' ' + this._joins.join(' ')      : ''; }

    /** Compile full SELECT SQL + all bindings */
    _compile() {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings: whereB, nextIndex } = this._buildWhere(1);
        const { sql: havingSql, bindings: havingB }          = this._buildHaving(nextIndex);
        const distinct = this._distinct ? 'DISTINCT ' : '';

        const sql =
            `SELECT ${distinct}${this._buildSelect()} FROM ${this._fqt}` +
            this._buildJoins() +
            whereSql +
            this._buildGroup() +
            havingSql +
            this._buildOrder() +
            this._buildLimit() +
            this._buildOffset();

        return { sql, bindings: [...whereB, ...havingB] };
    }

    _compileCount(expr = '*') {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings: whereB, nextIndex } = this._buildWhere(1);
        const { sql: havingSql, bindings: havingB }          = this._buildHaving(nextIndex);

        const sql =
            `SELECT COUNT(${expr}) AS aggregate FROM ${this._fqt}` +
            this._buildJoins() +
            whereSql +
            this._buildGroup() +
            havingSql;

        return { sql, bindings: [...whereB, ...havingB] };
    }

    _compileAggregate(fn, col) {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere(1);

        const sql =
            `SELECT ${fn}("${col}") AS aggregate FROM ${this._fqt}` +
            this._buildJoins() +
            whereSql;

        return { sql, bindings };
    }

    async _exec(sql, bindings = []) {
        const db = new Database();
        return db.query(sql, bindings);
    }

    _hydrate(rows) {
        return rows.map(row => {
            const inst      = new this._model();
            Object.assign(inst, row);
            inst._exists    = true;
            inst._original  = { ...row };
            return inst;
        });
    }

    async _eagerLoad(instances) {
        for (const rel of this._withs) {
            const fn = this._model.prototype[rel];
            if (typeof fn !== 'function') continue;
            for (const inst of instances) inst[rel] = await fn.call(inst);
        }
        for (const rel of this._withCounts) {
            const fn = this._model.prototype[rel];
            if (typeof fn !== 'function') continue;
            for (const inst of instances) {
                const related = await fn.call(inst);
                inst[`${rel}_count`] = Array.isArray(related) ? related.length : (related ? 1 : 0);
            }
        }
        return instances;
    }

    // ─── Push WHERE helpers ───────────────────────────────────────────────────

    _pushWhere(connector, sql, bindings = []) {
        if (!this._wheres.length) {
            this._wheres.push({ sql, bindings });
        } else {
            this._wheres.push({ sql: `${connector} ${sql}`, bindings });
        }
        return this;
    }

    // ─── SELECT ───────────────────────────────────────────────────────────────

    /**
     * SELECT specific columns.
     * Pass column names or raw expressions (e.g. 'COUNT(*) as total').
     */
    select(...cols) {
        this._selects.push(
            ...cols.flat().map(c =>
                // raw expression if it contains ( or space
                /[( ]/.test(c) ? c : `${this._fqt}."${c}"`
            )
        );
        return this;
    }

    /** Add DISTINCT to the SELECT */
    distinct() {
        this._distinct = true;
        return this;
    }

    // ─── WHERE ────────────────────────────────────────────────────────────────

    /** WHERE col = value */
    where(col, value) {
        return this._pushWhere('AND', `${this._fqt}."${col}" = ?`, [value]);
    }

    /**
     * WHERE col <op> value
     * Supported: =, !=, <>, <, >, <=, >=, LIKE, ILIKE, NOT LIKE, ~, ~*, !~, !~*
     */
    whereOp(col, op, value) {
        return this._pushWhere('AND', `${this._fqt}."${col}" ${op} ?`, [value]);
    }

    /** OR WHERE col = value */
    orWhere(col, value) {
        return this._pushWhere('OR', `${this._fqt}."${col}" = ?`, [value]);
    }

    /** OR WHERE col <op> value */
    orWhereOp(col, op, value) {
        return this._pushWhere('OR', `${this._fqt}."${col}" ${op} ?`, [value]);
    }

    /** AND WHERE (alias for where) */
    andWhere(col, value) {
        return this.where(col, value);
    }

    /** WHERE col IN (...values) */
    whereIn(col, values) {
        if (!values.length) return this._pushWhere('AND', '1 = 0', []);
        const placeholders = values.map(() => '?').join(', ');
        return this._pushWhere('AND', `${this._fqt}."${col}" IN (${placeholders})`, values);
    }

    /** WHERE col NOT IN (...values) */
    whereNotIn(col, values) {
        if (!values.length) return this;
        const placeholders = values.map(() => '?').join(', ');
        return this._pushWhere('AND', `${this._fqt}."${col}" NOT IN (${placeholders})`, values);
    }

    /** WHERE col IS NULL */
    whereNull(col) {
        return this._pushWhere('AND', `${this._fqt}."${col}" IS NULL`, []);
    }

    /** WHERE col IS NOT NULL */
    whereNotNull(col) {
        return this._pushWhere('AND', `${this._fqt}."${col}" IS NOT NULL`, []);
    }

    /** WHERE col BETWEEN min AND max */
    whereBetween(col, min, max) {
        return this._pushWhere('AND', `${this._fqt}."${col}" BETWEEN ? AND ?`, [min, max]);
    }

    /** WHERE col NOT BETWEEN min AND max */
    whereNotBetween(col, min, max) {
        return this._pushWhere('AND', `${this._fqt}."${col}" NOT BETWEEN ? AND ?`, [min, max]);
    }

    /** WHERE col LIKE pattern */
    whereLike(col, pattern) {
        return this._pushWhere('AND', `${this._fqt}."${col}" LIKE ?`, [pattern]);
    }

    /** WHERE col ILIKE pattern  (PostgreSQL native case-insensitive LIKE) */
    whereILike(col, pattern) {
        return this._pushWhere('AND', `${this._fqt}."${col}" ILIKE ?`, [pattern]);
    }

    /**
     * Raw WHERE fragment — use $1/$2 style OR ? style (auto-converted).
     * @param {string} sql
     * @param {any[]}  bindings
     */
    whereRaw(sql, bindings = []) {
        return this._pushWhere('AND', sql, bindings);
    }

    // ─── JOIN ─────────────────────────────────────────────────────────────────

    _addJoin(type, table, localCol, op, foreignCol) {
        this._joins.push(
            `${type} JOIN "${table}" ON ${this._fqt}."${localCol}" ${op} "${table}"."${foreignCol}"`
        );
        return this;
    }

    join(table, localCol, op, foreignCol)       { return this._addJoin('INNER', table, localCol, op, foreignCol); }
    innerJoin(table, localCol, op, foreignCol)  { return this._addJoin('INNER', table, localCol, op, foreignCol); }
    leftJoin(table, localCol, op, foreignCol)   { return this._addJoin('LEFT',  table, localCol, op, foreignCol); }
    rightJoin(table, localCol, op, foreignCol)  { return this._addJoin('RIGHT', table, localCol, op, foreignCol); }
    outerJoin(table, localCol, op, foreignCol)  { return this._addJoin('FULL OUTER', table, localCol, op, foreignCol); }
    fullJoin(table, localCol, op, foreignCol)   { return this._addJoin('FULL OUTER', table, localCol, op, foreignCol); }

    /** Raw JOIN fragment */
    joinRaw(sql) {
        this._joins.push(sql);
        return this;
    }

    // ─── ORDER ────────────────────────────────────────────────────────────────

    /** ORDER BY col ASC */
    orderBy(col, dir = 'ASC') {
        this._orders.push(`${this._fqt}."${col}" ${dir.toUpperCase()}`);
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
        this._groups.push(`${this._fqt}."${col}"`);
        return this;
    }

    groupByRaw(sql) {
        this._groups.push(sql);
        return this;
    }

    having(sql, bindings = []) {
        this._havings.push({ sql, bindings });
        return this;
    }

    // ─── LIMIT / OFFSET ───────────────────────────────────────────────────────

    limit(n)  { this._limitVal  = n; return this; }
    offset(n) { this._offsetVal = n; return this; }

    // ─── EAGER LOAD ───────────────────────────────────────────────────────────

    with(...relations)      { this._withs.push(...relations.flat());      return this; }
    withCount(...relations) { this._withCounts.push(...relations.flat()); return this; }

    // ─── FETCH METHODS ────────────────────────────────────────────────────────

    /**
     * Execute and return all matching rows as PgModel instances.
     * @returns {Promise<PgModel[]>}
     */
    async get() {
        const { sql, bindings } = this._compile();
        const result = await this._exec(sql, bindings);
        if (result.is_error) return [];
        const instances = this._hydrate(result.data);
        if (this._withs.length || this._withCounts.length) await this._eagerLoad(instances);
        return instances;
    }

    /** Return first matching row or null. */
    async first() {
        this._limitVal = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /** Return last row by primary key. */
    async last() {
        this.orderByDesc(this._pk);
        this._limitVal = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }

    /** Find by primary key. Returns instance or null. */
    async find(id) {
        return this.where(this._pk, id).first();
    }

    /** Find by primary key. Throws if not found. */
    async findOrFail(id) {
        const row = await this.find(id);
        if (!row) throw new Error(`${this._model.name}: No record found for ${this._pk}=${id}`);
        return row;
    }

    /** Find first row by field/value. */
    async findBy(col, value) {
        return this.where(col, value).first();
    }

    /** Find one row by conditions object. */
    async findOne(conditions = {}) {
        for (const [k, v] of Object.entries(conditions)) this.where(k, v);
        return this.first();
    }

    /** Find all rows matching a field/value pair. */
    async findAll(col, value) {
        return this.where(col, value).get();
    }

    /** findById — alias for find (mirrors MongoDB API). */
    async findById(id) {
        return this.find(id);
    }

    /** Return all rows. */
    async all() { return this.get(); }

    // ─── PLUCK / KEY-BY / CHUNK ───────────────────────────────────────────────

    /**
     * Return flat array of values for a single column.
     * @param {string} col
     */
    async pluck(col) {
        const wasDistinct = this._distinct;
        this._selects = [wasDistinct
            ? `DISTINCT ${this._fqt}."${col}"`
            : `${this._fqt}."${col}"`
        ];
        this._distinct = false;
        const { sql, bindings } = this._compile();
        const result = await this._exec(sql, bindings);
        if (result.is_error) return [];
        return result.data.map(r => r[col]);
    }

    /**
     * Return rows as object keyed by the given column.
     * @param {string} col
     */
    async keyBy(col) {
        const rows = await this.get();
        return Object.fromEntries(rows.map(r => [r[col], r]));
    }

    /**
     * Process results in chunks to avoid large memory usage.
     * @param {number}   size
     * @param {Function} callback  - receives PgModel[] chunk
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
     * @param {number} page    - 1-based page number
     * @param {number} perPage - rows per page (default 15)
     */
    async paginate(page = 1, perPage = 15) {
        // Run count on a clone before mutating limit/offset
        const countClone = this._clone();
        const { sql: cSql, bindings: cBind } = countClone._compileCount();
        const cResult = await this._exec(cSql, cBind);
        const total   = cResult.is_error ? 0 : Number(cResult.data[0]?.aggregate ?? 0);

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

    async count(col = '*') {
        const expr = col === '*' ? '*' : `"${col}"`;
        const { sql, bindings } = this._compileCount(expr);
        const result = await this._exec(sql, bindings);
        return result.is_error ? 0 : Number(result.data[0]?.aggregate ?? 0);
    }

    async sum(col) {
        return this._runAggregate('SUM', col);
    }

    async avg(col) {
        return this._runAggregate('AVG', col);
    }

    async min(col) {
        return this._runAggregate('MIN', col);
    }

    async max(col) {
        return this._runAggregate('MAX', col);
    }

    async _runAggregate(fn, col) {
        const { sql, bindings } = this._compileAggregate(fn, col);
        const result = await this._exec(sql, bindings);
        if (result.is_error) return null;
        const val = result.data[0]?.aggregate;
        return val !== undefined ? Number(val) : null;
    }

    /** Returns true if any row matches. */
    async exists() {
        return (await this.count()) > 0;
    }

    /** Returns true if NO rows match. */
    async doesntExist() {
        return !(await this.exists());
    }

    // ─── UPDATE (QueryBuilder level) ─────────────────────────────────────────

    /**
     * UPDATE all rows matching current WHERE with given data.
     * Returns raw pg result.
     * @param {object} data
     */
    async updateWhere(data) {
        this._applyGlobalScopes();
        const keys   = Object.keys(data);
        const values = Object.values(data);

        // SET clause: "col" = $1, "col2" = $2, …
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

        // WHERE clause starts at $keys.length + 1
        const { sql: whereSql, bindings: whereB } = this._buildWhere(keys.length + 1);
        const sql = `UPDATE ${this._fqt} SET ${sets}${whereSql}`;

        return this._exec(sql, [...values, ...whereB]);
    }

    // ─── DELETE (QueryBuilder level) ─────────────────────────────────────────

    /** DELETE all rows matching current WHERE. */
    async deleteWhere() {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere(1);
        const sql = `DELETE FROM ${this._fqt}${whereSql}`;
        return this._exec(sql, bindings);
    }

    // ─── INCREMENT / DECREMENT ────────────────────────────────────────────────

    /** Increment a column by amount for all matching rows. */
    async increment(col, amount = 1) {
        this._applyGlobalScopes();
        const { sql: whereSql, bindings } = this._buildWhere(2);
        const sql = `UPDATE ${this._fqt} SET "${col}" = "${col}" + $1${whereSql}`;
        return this._exec(sql, [amount, ...bindings]);
    }

    /** Decrement a column by amount for all matching rows. */
    async decrement(col, amount = 1) {
        return this.increment(col, -amount);
    }

    // ─── RAW ──────────────────────────────────────────────────────────────────

    /** Execute a raw SQL string with positional params. */
    async raw(sql, bindings = []) {
        return this._exec(sql, bindings);
    }

    // ─── INTERNAL UTILS ───────────────────────────────────────────────────────

    _clone() {
        const c = new QueryBuilder(this._model);
        c._selects      = [...this._selects];
        c._distinct     = this._distinct;
        c._wheres       = this._wheres.map(w => ({ ...w, bindings: [...w.bindings] }));
        c._joins        = [...this._joins];
        c._orders       = [...this._orders];
        c._groups       = [...this._groups];
        c._havings      = this._havings.map(h => ({ ...h, bindings: [...h.bindings] }));
        c._limitVal     = this._limitVal;
        c._offsetVal    = this._offsetVal;
        c._withs        = [...this._withs];
        c._withCounts   = [...this._withCounts];
        c._scopesApplied = this._scopesApplied;
        return c;
    }
}

// ─── PgModel ──────────────────────────────────────────────────────────────────

/**
 * PgModel
 *
 * Base class for all PostgreSQL ORM models. Mirrors the SQLite & MongoDB APIs.
 *
 * @example
 * class User extends PgModel {
 *     static table      = 'users';
 *     static schema     = 'public';      // optional
 *     static primaryKey = 'id';
 *     static fillable   = ['name', 'email', 'active'];
 *
 *     async posts() { return Post.where('user_id', this.id).get(); }
 * }
 */
class PgModel {

    // ── Subclass overrides ────────────────────────────────────────────────────

    /** @type {string} PostgreSQL table name */
    static table      = '';

    /** @type {string} PostgreSQL schema (default: public) */
    static schema     = 'public';

    /** @type {string} Primary key column */
    static primaryKey = 'id';

    /** @type {string[]} Mass-assignable columns */
    static fillable   = [];

    /** @type {string[]} Guarded columns */
    static guarded    = [];

    /** @type {object} Named local scopes */
    static scopes     = {};

    /** @type {object} Global scopes (auto-applied to every query) */
    static _globalScopes = {};

    // ── Instance state ────────────────────────────────────────────────────────

    constructor(attributes = {}) {
        this._exists   = false;
        this._original = {};
        if (Object.keys(attributes).length) this._fill(attributes);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    static _qb() {
        return new QueryBuilder(this);
    }

    static _db() {
        return new Database();
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

    static get _fqt() {
        return this.schema === 'public'
            ? `"${this.table}"`
            : `"${this.schema}"."${this.table}"`;
    }

    // ─── Static query entry points ────────────────────────────────────────────

    static where(c, v)              { return this._qb().where(c, v); }
    static whereOp(c, op, v)        { return this._qb().whereOp(c, op, v); }
    static orWhere(c, v)            { return this._qb().orWhere(c, v); }
    static orWhereOp(c, op, v)      { return this._qb().orWhereOp(c, op, v); }
    static andWhere(c, v)           { return this._qb().andWhere(c, v); }
    static whereIn(c, vs)           { return this._qb().whereIn(c, vs); }
    static whereNotIn(c, vs)        { return this._qb().whereNotIn(c, vs); }
    static whereNull(c)             { return this._qb().whereNull(c); }
    static whereNotNull(c)          { return this._qb().whereNotNull(c); }
    static whereBetween(c, a, b)    { return this._qb().whereBetween(c, a, b); }
    static whereNotBetween(c, a, b) { return this._qb().whereNotBetween(c, a, b); }
    static whereLike(c, p)          { return this._qb().whereLike(c, p); }
    static whereILike(c, p)         { return this._qb().whereILike(c, p); }
    static whereRaw(sql, b = [])    { return this._qb().whereRaw(sql, b); }
    static select(...cols)          { return this._qb().select(...cols); }
    static distinct()               { return this._qb().distinct(); }
    static orderBy(c, d)            { return this._qb().orderBy(c, d); }
    static orderByDesc(c)           { return this._qb().orderByDesc(c); }
    static orderByRaw(sql)          { return this._qb().orderByRaw(sql); }
    static groupBy(c)               { return this._qb().groupBy(c); }
    static groupByRaw(sql)          { return this._qb().groupByRaw(sql); }
    static having(sql, b)           { return this._qb().having(sql, b); }
    static limit(n)                 { return this._qb().limit(n); }
    static offset(n)                { return this._qb().offset(n); }
    static join(t, l, op, f)        { return this._qb().join(t, l, op, f); }
    static leftJoin(t, l, op, f)    { return this._qb().leftJoin(t, l, op, f); }
    static rightJoin(t, l, op, f)   { return this._qb().rightJoin(t, l, op, f); }
    static innerJoin(t, l, op, f)   { return this._qb().innerJoin(t, l, op, f); }
    static outerJoin(t, l, op, f)   { return this._qb().outerJoin(t, l, op, f); }
    static fullJoin(t, l, op, f)    { return this._qb().fullJoin(t, l, op, f); }
    static joinRaw(sql)             { return this._qb().joinRaw(sql); }
    static with(...r)               { return this._qb().with(...r); }
    static withCount(...r)          { return this._qb().withCount(...r); }
    static pluck(c)                 { return this._qb().pluck(c); }
    static keyBy(c)                 { return this._qb().keyBy(c); }
    static chunk(sz, cb)            { return this._qb().chunk(sz, cb); }
    static increment(c, amt)        { return this._qb().increment(c, amt); }
    static decrement(c, amt)        { return this._qb().decrement(c, amt); }
    static count(c)                 { return this._qb().count(c); }
    static sum(c)                   { return this._qb().sum(c); }
    static avg(c)                   { return this._qb().avg(c); }
    static min(c)                   { return this._qb().min(c); }
    static max(c)                   { return this._qb().max(c); }
    static exists()                 { return this._qb().exists(); }
    static doesntExist()            { return this._qb().doesntExist(); }

    /** Apply a named local scope. */
    static scope(name, ...args) {
        const fn = this.scopes[name];
        if (!fn) throw new Error(`Scope "${name}" not defined on ${this.name}`);
        const qb = this._qb();
        fn(qb, ...args);
        return qb;
    }

    /** Register a global scope (applied to every query on this model). */
    static globalScope(name, fn) {
        this._globalScopes = { ...this._globalScopes, [name]: fn };
    }

    // ─── FIND ─────────────────────────────────────────────────────────────────

    static find(id)              { return this._qb().find(id); }
    static findById(id)          { return this._qb().findById(id); }
    static findOrFail(id)        { return this._qb().findOrFail(id); }
    static findBy(col, value)    { return this._qb().findBy(col, value); }
    static findOne(conditions)   { return this._qb().findOne(conditions); }
    static findAll(col, value)   { return this._qb().findAll(col, value); }
    static all()                 { return this._qb().all(); }
    static first()               { return this._qb().first(); }
    static last()                { return this._qb().last(); }
    static get()                 { return this._qb().get(); }
    static paginate(page, pp)    { return this._qb().paginate(page, pp); }

    // ─── INSERT / CREATE ──────────────────────────────────────────────────────

    /**
     * INSERT a row and return hydrated PgModel instance.
     * Uses RETURNING * to get the full row including generated columns.
     * @param {object} data
     */
    static async create(data) {
        const result = await this._insertReturning(data);
        if (result.is_error) throw new Error(result.message);
        return this._hydrateOne(result.data[0]);
    }

    /**
     * INSERT OR IGNORE via ON CONFLICT DO NOTHING.
     * Returns the new instance or null on conflict.
     * @param {object} data
     */
    static async createOrIgnore(data) {
        const cols  = Object.keys(data);
        const vals  = Object.values(data);
        const ph    = cols.map((_, i) => `$${i + 1}`).join(', ');
        const sql   = `INSERT INTO ${this._fqt} (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${ph}) ON CONFLICT DO NOTHING RETURNING *`;
        const result = await this._db().query(sql, vals);
        if (result.is_error || !result.data.length) return null;
        return this._hydrateOne(result.data[0]);
    }

    /**
     * INSERT multiple rows. Returns PgModel[].
     * @param {object[]} rows
     */
    static async createMany(rows) {
        return Promise.all(rows.map(r => this.create(r)));
    }

    /**
     * Find first row matching conditions, or create it.
     * @param {object} conditions
     * @param {object} [data={}]
     */
    static async firstOrCreate(conditions, data = {}) {
        let inst = await this.findOne(conditions);
        if (!inst) inst = await this.create({ ...conditions, ...data });
        return inst;
    }

    /**
     * Upsert — find by conditions, update with data, or create if not found.
     * Uses PostgreSQL INSERT … ON CONFLICT DO UPDATE.
     * @param {object} conditions  - columns used as conflict target
     * @param {object} data        - columns to set on upsert
     */
    static async updateOrCreate(conditions, data) {
        const allData    = { ...conditions, ...data };
        const cols       = Object.keys(allData);
        const vals       = Object.values(allData);
        const ph         = cols.map((_, i) => `$${i + 1}`).join(', ');
        const conflictCols = Object.keys(conditions).map(c => `"${c}"`).join(', ');
        const updateCols   = Object.keys(data).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

        const sql = `
            INSERT INTO ${this._fqt} (${cols.map(c => `"${c}"`).join(', ')})
            VALUES (${ph})
            ON CONFLICT (${conflictCols})
            DO UPDATE SET ${updateCols}
            RETURNING *
        `;

        const result = await this._db().query(sql, vals);
        if (result.is_error) throw new Error(result.message);
        return this._hydrateOne(result.data[0]);
    }

    /**
     * Low-level INSERT — returns raw Database result (no hydration).
     * @param {object} data
     */
    static async insert(data) {
        return this._insertReturning(data);
    }

    /**
     * Low-level bulk INSERT — returns array of raw results.
     * @param {object[]} rows
     */
    static async insertMany(rows) {
        return Promise.all(rows.map(r => this.insert(r)));
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    /**
     * UPDATE a single row by primary key. Returns updated instance.
     * @param {*}      id
     * @param {object} data
     */
    static async update(id, data) {
        const keys   = Object.keys(data);
        const vals   = Object.values(data);
        const sets   = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const sql    = `UPDATE ${this._fqt} SET ${sets} WHERE "${this.primaryKey}" = $${keys.length + 1} RETURNING *`;
        const result = await this._db().query(sql, [...vals, id]);
        if (result.is_error) throw new Error(result.message);
        return result.data.length ? this._hydrateOne(result.data[0]) : null;
    }

    /**
     * UPDATE multiple rows by primary key.
     * @param {Array<[id, object]>} pairs
     */
    static async updateMany(pairs) {
        return Promise.all(pairs.map(([id, data]) => this.update(id, data)));
    }

    /**
     * UPDATE all rows matching conditions.
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
     * DELETE a row by primary key.
     * @param {*} id
     */
    static async delete(id) {
        const sql = `DELETE FROM ${this._fqt} WHERE "${this.primaryKey}" = $1`;
        return this._db().query(sql, [id]);
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

    /** Alias for delete. */
    static destroy(id) { return this.delete(id); }

    /** Delete every row in the table (TRUNCATE for speed). */
    static async truncate() {
        return this._db().query(`TRUNCATE TABLE ${this._fqt} RESTART IDENTITY CASCADE`);
    }

    // ─── RAW ──────────────────────────────────────────────────────────────────

    /**
     * Execute raw SQL.
     * @param {string} sql
     * @param {any[]}  bindings  - positional $1, $2, … params
     */
    static raw(sql, bindings = []) {
        return this._db().query(sql, bindings);
    }

    /** Alias for raw. */
    static query(sql, bindings = []) {
        return this._db().query(sql, bindings);
    }

    // ─── MIGRATE / SEED ───────────────────────────────────────────────────────

    /**
     * Migrate — ensures the table exists using the model's schema definition.
     * Override this in your subclass and call Schema.create(...) there.
     */
    static async migrate() {
        return {
            is_error: false,
            message:  `ℹ Override migrate() in "${this.name}" and call Schema.create().`,
        };
    }

    /**
     * Rollback — drops the table.
     * @param {boolean} [cascade=false]
     */
    static async rollbackMigration(cascade = false) {
        const sql    = `DROP TABLE IF EXISTS ${this._fqt}${cascade ? ' CASCADE' : ''}`;
        const result = await this._db().query(sql);
        result.message = result.is_error
            ? `❗ Rollback failed for "${this.table}": ${result.message}`
            : `✔ Table "${this.table}" dropped.`;
        return result;
    }

    /**
     * Seed the table with rows. Uses createOrIgnore so re-running is safe.
     * @param {object[]} rows
     */
    static async seed(rows) {
        const results  = await Promise.allSettled(rows.map(r => this.createOrIgnore(r)));
        const inserted = results.filter(r => r.status === 'fulfilled' && r.value).length;
        const skipped  = results.length - inserted;
        return { is_error: false, message: `✔ Seeded ${inserted} rows. ${skipped} skipped (conflict).` };
    }

    // ─── INSTANCE METHODS ─────────────────────────────────────────────────────

    /**
     * Save — INSERT if new, UPDATE if existing.
     */
    async save() {
        const pk   = this.constructor.primaryKey;
        const data = this._toData();

        if (this._exists) {
            const result = await this.constructor.update(this[pk], data);
            if (result) Object.assign(this._original, result._original || data);
            return result;
        } else {
            const inst   = await this.constructor.create(data);
            this[pk]     = inst[pk];
            this._exists = true;
            this._original = { ...inst._original };
            return inst;
        }
    }

    /**
     * Update this instance with new attributes and persist.
     * @param {object} data
     */
    async update(data) {
        Object.assign(this, data);
        return this.save();
    }

    /** Delete this instance from the database. */
    async delete() {
        const pk = this.constructor.primaryKey;
        const result = await this.constructor.delete(this[pk]);
        this._exists = false;
        return result;
    }

    /** Reload this instance from the database. */
    async refresh() {
        const pk    = this.constructor.primaryKey;
        const fresh = await this.constructor.find(this[pk]);
        if (!fresh) throw new Error(`${this.constructor.name}: record no longer exists`);
        Object.assign(this, fresh);
        this._original = { ...fresh._original };
        return this;
    }

    /** Alias for refresh. */
    async reload() { return this.refresh(); }

    /**
     * Increment a column on this instance.
     * @param {string} col
     * @param {number} [amount=1]
     */
    async increment(col, amount = 1) {
        const pk = this.constructor.primaryKey;
        await this.constructor._qb().where(pk, this[pk]).increment(col, amount);
        this[col] = (this[col] || 0) + amount;
        return this;
    }

    /**
     * Decrement a column on this instance.
     * @param {string} col
     * @param {number} [amount=1]
     */
    async decrement(col, amount = 1) {
        return this.increment(col, -amount);
    }

    /** Serialize to plain object (strips _ internals). */
    toJSON() {
        const obj = {};
        for (const k of Object.keys(this)) {
            if (!k.startsWith('_')) obj[k] = this[k];
        }
        return obj;
    }

    /** Serialize to array of [key, value] pairs. */
    toArray() {
        return Object.entries(this.toJSON());
    }

    // ─── RELATIONS ────────────────────────────────────────────────────────────

    /**
     * belongsTo — this row has a FK pointing to a parent.
     *
     * @param {typeof PgModel} RelatedModel
     * @param {string} [foreignKey]  - FK on this table  (default: relatedTable_id)
     * @param {string} [ownerKey]    - PK on parent table (default: 'id')
     *
     * @example
     * // In Post instance:
     * async user() { return this.belongsTo(User, 'user_id'); }
     */
    async belongsTo(RelatedModel, foreignKey, ownerKey = 'id') {
        const fk = foreignKey || `${RelatedModel.table.replace(/s$/, '')}_id`;
        return RelatedModel.where(ownerKey, this[fk]).first();
    }

    /**
     * hasOne — PK on this table is referenced by FK on related table.
     *
     * @param {typeof PgModel} RelatedModel
     * @param {string} [foreignKey]  - FK on related table
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
     * @param {typeof PgModel} RelatedModel
     * @param {string} [foreignKey]
     * @param {string} [localKey]
     */
    async hasMany(RelatedModel, foreignKey, localKey) {
        const lk = localKey || this.constructor.primaryKey;
        const fk = foreignKey || `${this.constructor.table.replace(/s$/, '')}_id`;
        return RelatedModel.where(fk, this[lk]).get();
    }

    /**
     * belongsToMany — many-to-many via junction (pivot) table.
     *
     * @param {typeof PgModel} RelatedModel
     * @param {string} pivotTable
     * @param {string} [localFK]    - FK in pivot for this model
     * @param {string} [foreignFK]  - FK in pivot for related model
     */
    async belongsToMany(RelatedModel, pivotTable, localFK, foreignFK) {
        const lk  = this.constructor.primaryKey;
        const lfk = localFK   || `${this.constructor.table.replace(/s$/, '')}_id`;
        const rfk = foreignFK || `${RelatedModel.table.replace(/s$/, '')}_id`;

        return RelatedModel._qb()
            .joinRaw(
                `INNER JOIN "${pivotTable}" ON "${pivotTable}"."${rfk}" = "${RelatedModel.table}"."${RelatedModel.primaryKey}"`
            )
            .whereRaw(`"${pivotTable}"."${lfk}" = $1`, [this[lk]])
            .get();
    }

    /**
     * Attach IDs to a many-to-many pivot table.
     * Uses INSERT … ON CONFLICT DO NOTHING to avoid duplicates.
     * @param {string}   pivotTable
     * @param {string}   localFK
     * @param {string}   foreignFK
     * @param {*[]}      ids
     * @param {object[]} [extraData=[]]
     */
    async attach(pivotTable, localFK, foreignFK, ids, extraData = []) {
        const lk = this.constructor.primaryKey;
        return Promise.all(ids.map((id, i) => {
            const row  = { [localFK]: this[lk], [foreignFK]: id, ...(extraData[i] || {}) };
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const ph   = cols.map((_, idx) => `$${idx + 1}`).join(', ');
            const sql  = `INSERT INTO "${pivotTable}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${ph}) ON CONFLICT DO NOTHING`;
            return new Database().query(sql, vals);
        }));
    }

    /**
     * Detach IDs from a many-to-many pivot table.
     * @param {string} pivotTable
     * @param {string} localFK
     * @param {string} foreignFK
     * @param {*[]}    [ids]  - if omitted, detaches all
     */
    async detach(pivotTable, localFK, foreignFK, ids) {
        const lk = this.constructor.primaryKey;
        if (!ids || !ids.length) {
            return new Database().query(
                `DELETE FROM "${pivotTable}" WHERE "${localFK}" = $1`,
                [this[lk]]
            );
        }
        const ph  = ids.map((_, i) => `$${i + 2}`).join(', ');
        return new Database().query(
            `DELETE FROM "${pivotTable}" WHERE "${localFK}" = $1 AND "${foreignFK}" IN (${ph})`,
            [this[lk], ...ids]
        );
    }

    /**
     * Sync pivot table — detach all then attach given IDs.
     * @param {string}   pivotTable
     * @param {string}   localFK
     * @param {string}   foreignFK
     * @param {*[]}      ids
     * @param {object[]} [extraData=[]]
     */
    async sync(pivotTable, localFK, foreignFK, ids, extraData = []) {
        await this.detach(pivotTable, localFK, foreignFK);
        return this.attach(pivotTable, localFK, foreignFK, ids, extraData);
    }

    // ─── EAGER / LAZY LOAD ────────────────────────────────────────────────────

    /**
     * Eagerly load a relation and attach as property.
     * @param {string} relation  - Method name on this instance
     */
    async eagerLoad(relation) {
        this[relation] = await this[relation]();
        return this;
    }

    /**
     * Lazy load (alias for eagerLoad).
     * @param {string} relation
     */
    async lazyLoad(relation) {
        return this.eagerLoad(relation);
    }

    // ─── Internal hydration helpers ───────────────────────────────────────────

    static _hydrateOne(row) {
        if (!row) return null;
        const inst      = new this();
        Object.assign(inst, row);
        inst._exists    = true;
        inst._original  = { ...row };
        return inst;
    }

    static async _insertReturning(data) {
        const cols = Object.keys(data);
        const vals = Object.values(data);
        const ph   = cols.map((_, i) => `$${i + 1}`).join(', ');
        const sql  = `INSERT INTO ${this._fqt} (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${ph}) RETURNING *`;
        return this._db().query(sql, vals);
    }
}

module.exports = { PgModel, QueryBuilder };