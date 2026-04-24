# Kalva

## Install Kalva Node.js Framework

Run this command to install the Kalva CLI globally on your machine.

```bash
npm install -g kalva
```

Run this command to create a new Kalva project.

```bash
kalva create-project <name>
```

## Help

Run this command to view all Kalva CLI commands.

```bash
kalva --help
```

This command lists all available Kalva commands.


### MySQL Drive
| Command | Description |
| :--- | :--- |
| bit(name, length = 1) | Create a BIT column with fixed binary length. |
| tinyInteger(name) | Create a TINYINT column for very small integers. |
| boolean(name) | Create a BOOLEAN column stored as TINYINT(1). |
| smallInteger(name) | Create a SMALLINT column. |
| mediumInteger(name) | Create a MEDIUMINT column. |
| integer(name) | Create an INT column. |
| int(name) | Alias of integer(), creates an INT column. |
| bigInteger(name) | Create a BIGINT column. |
| decimal(name, p = 10, s = 2) | Create a DECIMAL column with precision and scale. |
| numeric(name, p = 10, s = 2) | Same as DECIMAL, creates NUMERIC column. |
| float(name, precision = null) | Create a FLOAT column with optional precision. |
| double(name, p = null, s = null) | Create a DOUBLE column with optional precision and scale. |
| real(name) | Create a REAL column. |
| date(name) | Create a DATE column. |
| datetime(name, fsp = 0) | Create a DATETIME column with optional fractional seconds. |
| timestamp(name, fsp = 0) | Create a TIMESTAMP column. |
| time(name, fsp = 0) | Create a TIME column. |
| year(name) | Create a YEAR column. |
| char(name, length = 1) | Create a fixed length CHAR column. |
| string(name, length = 255) | Create a VARCHAR column. |
| varchar(name, length = 255) | Alias of string(). |
| tinyText(name) | Create a TINYTEXT column. |
| text(name) | Create a TEXT column. |
| mediumText(name) | Create a MEDIUMTEXT column. |
| longText(name) | Create a LONGTEXT column. |
| binary(name, length = 1) | Create a fixed length binary column. |
| varBinary(name, length = 255) | Create a variable length binary column. |
| tinyBlob(name) | Create a TINYBLOB column. |
| blob(name) | Create a BLOB column. |
| mediumBlob(name) | Create a MEDIUMBLOB column. |
| longBlob(name) | Create a LONGBLOB column. |
| json(name) | Create a JSON column. |
| geometry(name) | Create a GEOMETRY column. |
| point(name) | Create a POINT column. |
| lineString(name) | Create a LINESTRING column. |
| polygon(name) | Create a POLYGON column. |
| multiPoint(name) | Create a MULTIPOINT column. |
| multiLineString(name) | Create a MULTILINESTRING column. |
| multiPolygon(name) | Create a MULTIPOLYGON column. |
| geometryCollection(name) | Create a GEOMETRYCOLLECTION column. |
| enum(name, ...values) | Create an ENUM column with predefined values. |
| increments(name = "id") | Create auto increment INT primary key. |
| bigIncrements(name = "id") | Create auto increment BIGINT primary key. |
| timestamps() | Add created_at and updated_at timestamp columns. |
| .nullable() | Allow NULL values in column. |
| .notNullable() | Disallow NULL values. |
| .default(value) | Set default value for column. |
| .unique() | Add UNIQUE constraint to column. |
| .primary() | Set column as PRIMARY KEY. |
| .autoIncrement() | Enable AUTO_INCREMENT and set PRIMARY KEY. |
| .unsigned() | Mark numeric column as UNSIGNED. |
| .zerofill() | Add ZEROFILL and UNSIGNED to numeric column. |
| .invisible() | Mark column as invisible. |
| .charset(value) | Set column character set. |
| .collate(value) | Set column collation. |
| .comment(value) | Add comment to column. |
| .check(expression) | Add CHECK constraint. |
| .after(column) | Place column after another column. |
| .generatedAs(expr, stored = false) | Create generated column (virtual or stored). |
| .references(table, column = "id", onDelete = "RESTRICT", onUpdate = "RESTRICT") | Add foreign key reference. |
| uniqueComposite(...cols) | Create composite UNIQUE constraint. |
| primaryComposite(...cols) | Create composite PRIMARY KEY. |
| addIndex(cols, name = null) | Create index on column(s). |
| fullText(cols, name = null) | Create FULLTEXT index. |
| spatialIndex(cols, name = null) | Create SPATIAL index. |
| engine(name) | Set table storage engine. |
| charset(charset) | Set table charset. |
| collate(collation) | Set table collation. |
| comment(text) | Add table comment. |
| modify(name) | Modify existing column definition. |
| dropColumn(name) | Drop a column from table. |
| renameColumn(from, to) | Rename a column. |
| addUniqueIndex(cols, name = null) | Add UNIQUE index. |
| addFullText(cols, name = null) | Add FULLTEXT index. |
| dropIndex(name) | Drop index by name. |
| dropPrimary() | Drop primary key. |
| addForeign(column, table, col, onDelete, onUpdate) | Add foreign key constraint. |
| dropForeign(name) | Drop foreign key constraint. |
| Schema.create(name, callback) | Create table using TableBuilder. |
| Schema.table(name, callback) | Alter table using AlterBuilder. |
| Schema.drop(name) | Drop table if exists. |
| Schema.rename(from, to) | Rename table. |
| Schema.hasTable(name) | Check if table exists. |
| Schema.hasColumn(table, column) | Check if column exists. |
| Schema.getColumns(table) | Get all column names in order. |
| toSQL() | Compile builder into SQL query. |

 