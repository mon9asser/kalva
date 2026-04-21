const { Database } = require("./database");

 
class ColumnBuilder {
    constructor(table, name, type) {
        this._table = table;
        this._name = name;
        this._type = type;
        this._nullable = false;
        this._default = undefined;
        this._unique = false;
        this._primary = false;
        this._autoIncrement = false;
        this._references = null;
        this._check = null;
        this._collation = null;
    }

    /** Allow NULL values */
    nullable() {
        this._nullable = true;
        return this;
    }

    /** NOT NULL (default behavior, explicit call) */
    notNullable() {
        this._nullable = false;
        return this;
    }

    /** DEFAULT value */
    default(value) {
        this._default = value;
        return this;
    }

    /** UNIQUE constraint */
    unique() {
        this._unique = true;
        return this;
    }

    /** PRIMARY KEY */
    primary() {
        this._primary = true;
        return this;
    }

    /** AUTOINCREMENT (only valid on INTEGER PRIMARY KEY) */
    autoIncrement() {
        this._autoIncrement = true;
        this._primary = true;
        return this;
    }

    /** REFERENCES foreign_table(foreign_col) */
    references(foreignTable, foreignCol = "id") {
        this._references = { table: foreignTable, col: foreignCol };
        return this;
    }

    /** CHECK constraint — raw SQL expression string */
    check(expr) {
        this._check = expr;
        return this;
    }

    /** COLLATE BINARY | NOCASE | RTRIM */
    collate(collation) {
        const valid = ["BINARY", "NOCASE", "RTRIM"];
        if (!valid.includes(collation.toUpperCase()))
            throw new Error(`Invalid collation: ${collation}. Choose from: ${valid.join(", ")}`);
        this._collation = collation.toUpperCase();
        return this;
    }

    /** Compile to SQL fragment */
    toSQL() {
        const parts = [`"${this._name}"`, this._type];

        if (this._collation) parts.push(`COLLATE ${this._collation}`);
        if (this._primary) parts.push("PRIMARY KEY");
        if (this._autoIncrement) parts.push("AUTOINCREMENT");
        if (!this._nullable && !this._primary) parts.push("NOT NULL");
        if (this._unique && !this._primary) parts.push("UNIQUE");

        if (this._default !== undefined) {
            const val = typeof this._default === "string"
                ? `'${this._default.replace(/'/g, "''")}'`
                : this._default;
            parts.push(`DEFAULT ${val}`);
        }

        if (this._check) parts.push(`CHECK (${this._check})`);

        if (this._references)
            parts.push(`REFERENCES "${this._references.table}"("${this._references.col}")`);

        return parts.join(" ");
    }
}

// ─── Table Builder ────────────────────────────────────────────────────────────

class TableBuilder {
    constructor(tableName) {
        this._name = tableName;
        this._columns = [];
        this._compositeUniques = [];
        this._compositePKs = [];
        this._ifNotExists = true;
    }

    // ── Numeric types ─────────────────────────────────────────────────────────

    /** INTEGER affinity */
    integer(name) {
        return this._addColumn(name, "INTEGER");
    }

    /** Alias for integer — common pattern for IDs */
    bigInteger(name) {
        return this._addColumn(name, "INTEGER");
    }

    /** REAL affinity (8-byte float) */
    real(name) {
        return this._addColumn(name, "REAL");
    }

    /** Alias: FLOAT -> REAL affinity */
    float(name) {
        return this._addColumn(name, "FLOAT");
    }

    /** DECIMAL -> NUMERIC affinity */
    decimal(name, _precision, _scale) {
        return this._addColumn(name, "DECIMAL");
    }

    /** NUMERIC affinity */
    numeric(name) {
        return this._addColumn(name, "NUMERIC");
    }

    // ── Text types ────────────────────────────────────────────────────────────

    /** VARCHAR(n) -> TEXT affinity */
    string(name, length = 255) {
        return this._addColumn(name, `VARCHAR(${length})`);
    }

    /** TEXT -> TEXT affinity */
    text(name) {
        return this._addColumn(name, "TEXT");
    }

    /** CHAR(n) -> TEXT affinity */
    char(name, length = 1) {
        return this._addColumn(name, `CHAR(${length})`);
    }

    // ── Boolean (stored as 0/1) ───────────────────────────────────────────────

    /** BOOLEAN -> NUMERIC affinity (0 / 1) */
    boolean(name) {
        return this._addColumn(name, "BOOLEAN");
    }

    // ── Date / Time ───────────────────────────────────────────────────────────

    /** Store as TEXT "YYYY-MM-DD HH:MM:SS" */
    datetime(name) {
        return this._addColumn(name, "DATETIME");
    }

    /** Store as TEXT "YYYY-MM-DD" */
    date(name) {
        return this._addColumn(name, "DATE");
    }

    /** Store as TEXT "HH:MM:SS" */
    time(name) {
        return this._addColumn(name, "TIME");
    }

    /** Unix timestamp -> INTEGER affinity */
    timestamp(name) {
        return this._addColumn(name, "INTEGER");
    }

    // ── Binary ────────────────────────────────────────────────────────────────

    /** BLOB -> no type conversion */
    blob(name) {
        return this._addColumn(name, "BLOB");
    }

    // ── Shortcuts ─────────────────────────────────────────────────────────────

    /**
     * Adds `id` INTEGER PRIMARY KEY AUTOINCREMENT
     * @param {string} [name="id"]
     */
    increments(name = "id") {
        return this._addColumn(name, "INTEGER").primary().autoIncrement();
    }

    /**
     * Adds `created_at` and `updated_at` DATETIME columns
     * (both nullable by default so they can be set by app logic)
     */
    timestamps() {
        this._addColumn("created_at", "DATETIME").default("CURRENT_TIMESTAMP");
        this._addColumn("updated_at", "DATETIME").nullable();
    }

    // ── Constraints ───────────────────────────────────────────────────────────

    /** UNIQUE (col1, col2, ...) */
    uniqueComposite(...cols) {
        this._compositeUniques.push(cols);
        return this;
    }

    /** PRIMARY KEY (col1, col2, ...) for composite PKs */
    primaryComposite(...cols) {
        this._compositePKs.push(cols);
        return this;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    _addColumn(name, type) {
        const col = new ColumnBuilder(this, name, type);
        this._columns.push(col);
        return col;
    }

    /** Compile to full CREATE TABLE SQL */
    toSQL() {
        if (this._columns.length === 0)
            throw new Error(`Table "${this._name}" has no columns defined.`);

        const exists = this._ifNotExists ? "IF NOT EXISTS " : "";
        const defs = this._columns.map((c) => `    ${c.toSQL()}`);

        for (const cols of this._compositeUniques)
            defs.push(`    UNIQUE (${cols.map((c) => `"${c}"`).join(", ")})`);

        for (const cols of this._compositePKs)
            defs.push(`    PRIMARY KEY (${cols.map((c) => `"${c}"`).join(", ")})`);

        return `CREATE TABLE ${exists}"${this._name}" (\n${defs.join(",\n")}\n);`;
    }
}

// ─── Schema ───────────────────────────────────────────────────────────────────

class Schema {
    /**
     * Define and create a table.
     *
     * @param {string}   name     - Table name
     * @param {Function} callback - Receives a TableBuilder instance
     * @returns {string}          - The generated SQL (also executed on the DB)
     *
     * @example
     * Schema.create('users', (table) => {
     *     table.increments('id');
     *     table.string('name').nullable();
     *     table.string('email').unique();
     *     table.boolean('active').default(1);
     *     table.timestamps();
     * });
     */
    static create(name, callback) {
        const table = new TableBuilder(name);
        callback(table);
        const sql = table.toSQL();
        Database.dbInstance.run(sql);
        return sql;
    }

    /**
     * Drop a table if it exists.
     * @param {string} name
     */
    static drop(name) {
        const sql = `DROP TABLE IF EXISTS "${name}";`;
        Database.dbInstance.run(sql);
        return sql;
    }

    /**
     * Check if a table exists (synchronous via Database helper).
     * @param {string} name
     * @returns {boolean}
     */
    static hasTable(name) {
        const row = Database.dbInstance.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
            [name]
        );
        return !!row;
    }
}

var query = Schema.create('users', (table) => {
    table.increments('id');
    table.string('name').nullable();
    table.string('email', 100).unique().notNullable();
    table.integer('age').check('age >= 0').default(0);
    table.boolean('active').default(1);
    table.integer('role_id').references('roles', 'id');
    table.timestamps();
});

console.log(query);

module.exports = { Schema, TableBuilder, ColumnBuilder };