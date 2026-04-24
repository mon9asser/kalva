# Kalva

## Install Kalva Node.js Framework

Run this command to install the Kalva CLI globally on your machine.

```bash
npm install -g kalva
```

Run this command to create a new Kalva project.

```bash
kalva create-project <project-name>
```

## Schema (Table)

schema system supports full table lifecycle control. It handles:
- Table creation
- Table alteration
- Table deletion
- Table renaming
- Column management
- Index management
- Foreign key management
- Schema introspection

You can push schemas and tables into the database once you finish building them using:

```bash
kalva post-blueprints
``` 

So, let’s see how to create executable files to use the previous command.


#### Table creation

That creates a schema file inside the blueprint folder like `/blueprint/<schema-name>.js`. You define your table structure inside this file.
```bash
kalva create-blueprint <schema-name>
```

You must replace `<schema-name>` with a name of table or schema like `user`.

```bash
kalva create-blueprint user
```

This will be placed here: `/blueprint/user.js`

It contains a structure similar to the one below, depending on the database you selected when you created the project.

```js
// MySQL Layer
await Schema.create("users", (t) => {
    t.increments("id");
    t.string("name", 150).notNullable();
    t.string("email", 100).unique();
    t.timestamps();
});

// MongoDB Layer
await MongoSchema.create('User', (collection) => {

});

// PostgreSQL Layer
..

// SQLite Layer
..
```

 


## Help

Run this command to view all Kalva CLI commands.

```bash
kalva --help
```

This command lists all available Kalva commands.


## Kalva Framework Documentation 

### MongoDB 

### MySQL   

**Columns (Add new columns)**

| Function | Description |
|----------|------------|
| t.bit(name, length) | Create BIT column with fixed length |
| t.tinyInteger(name) | Create TINYINT column |
| t.boolean(name) | Create BOOLEAN column |
| t.smallInteger(name) | Create SMALLINT column |
| t.mediumInteger(name) | Create MEDIUMINT column |
| t.integer(name) | Create INT column |
| t.int(name) | Alias of integer |
| t.bigInteger(name) | Create BIGINT column |
| t.decimal(name, precision, scale) | Create DECIMAL column with precision and scale |
| t.numeric(name, precision, scale) | Same as decimal |
| t.float(name, precision) | Create FLOAT column |
| t.double(name, precision, scale) | Create DOUBLE column |
| t.real(name) | Create REAL column |
| t.date(name) | Create DATE column |
| t.datetime(name, fsp) | Create DATETIME column |
| t.timestamp(name, fsp) | Create TIMESTAMP column |
| t.time(name, fsp) | Create TIME column |
| t.year(name) | Create YEAR column |
| t.char(name, length) | Create CHAR column |
| t.string(name, length) | Create STRING column |
| t.varchar(name, length) | Create VARCHAR column |
| t.tinyText(name) | Create TINYTEXT column |
| t.text(name) | Create TEXT column |
| t.mediumText(name) | Create MEDIUMTEXT column |
| t.longText(name) | Create LONGTEXT column |
| t.binary(name, length) | Create BINARY column |
| t.varBinary(name, length) | Create VARBINARY column |
| t.tinyBlob(name) | Create TINYBLOB column |
| t.blob(name) | Create BLOB column |
| t.mediumBlob(name) | Create MEDIUMBLOB column |
| t.longBlob(name) | Create LONGBLOB column |
| t.json(name) | Create JSON column |
| t.geometry(name) | Create GEOMETRY column |
| t.point(name) | Create POINT column |
| t.lineString(name) | Create LINESTRING column |
| t.polygon(name) | Create POLYGON column |
| t.multiPoint(name) | Create MULTIPOINT column |
| t.multiLineString(name) | Create MULTILINESTRING column |
| t.multiPolygon(name) | Create MULTIPOLYGON column |
| t.geometryCollection(name) | Create GEOMETRYCOLLECTION column |
| t.enum(name, ...values) | Create ENUM column with values |
| t.timestamps() | Add created_at and updated_at |

---

**Column Modifiers**

| Function | Description |
|----------|------------|
| .nullable() | Allow NULL values |
| .notNullable() | Disallow NULL values |
| .default(value) | Set default value |
| .unique() | Add UNIQUE constraint |
| .primary() | Set as PRIMARY KEY |
| .unsigned() | Set UNSIGNED |
| .autoIncrement() | Enable auto increment |
| .zerofill() | Enable ZEROFILL |
| .invisible() | Make column invisible |
| .charset(value) | Set charset |
| .collate(value) | Set collation |
| .comment(value) | Add column comment |
| .check(expression) | Add CHECK constraint |
| .after(columnName) | Place column after another |
| .generatedAs(expression, stored) | Create generated column |
| .references(table, column, onDelete, onUpdate) | Add foreign key reference |

---

**Modify Existing Column**

| Function | Description |
|----------|------------|
| t.modify("column").string(null, 200).notNullable().unique() | Modify column type and constraints |
| t.modify("age").integer().unsigned() | Modify integer column |
| t.modify("price").decimal(null, 10, 2).default(0) | Modify decimal column |

---

**Drop / Rename Columns**

| Function | Description |
|----------|------------|
| t.dropColumn("column") | Drop column |
| t.renameColumn("old", "new") | Rename column |

---

**Indexes**

| Function | Description |
|----------|------------|
| t.addIndex(columns, indexName) | Add index |
| t.addUniqueIndex(columns, indexName) | Add unique index |
| t.addFullText(columns, indexName) | Add fulltext index |
| t.dropIndex(indexName) | Drop index |
| t.dropPrimary() | Drop primary key |

---

**Foreign Keys**

| Function | Description |
|----------|------------|
| t.addForeign(column, table, foreignColumn, onDelete, onUpdate) | Add foreign key |
| t.dropForeign(constraintName) | Drop foreign key |

---

**Example**

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

- [Database Doc](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-database-documentation.md)
- [Blueprint Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-schema-documentation.md)
- [ORM & Query Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-orm-documentation.md) 


### PostgreSQL

### SQLite  
