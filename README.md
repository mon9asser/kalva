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
| tinyInteger(name) | Create a TINYINT column for very small integer values. |
| boolean(name) | Create a BOOLEAN column stored as TINYINT(1). |
| smallInteger(name) | Create a SMALLINT column for small integer values. |
| mediumInteger(name) | Create a MEDIUMINT column for medium range integers. |
| integer(name) | Create an INT column for standard integer values. |
| int(name) | Alias of integer(name), creates an INT column. |
| bigInteger(name) | Create a BIGINT column for large integer values. |
| decimal(name, p = 10, s = 2) | Create a DECIMAL column with precision and scale. |
| numeric(name, p = 10, s = 2) | Same as DECIMAL, creates a NUMERIC column. |
| float(name, precision = null) | Create a FLOAT column with optional precision. |
| double(name, p = null, s = null) | Create a DOUBLE column with optional precision and scale. |
| real(name) | Create a REAL column for floating point numbers. |
| date(name) | Create a DATE column to store date values. |
| datetime(name, fsp = 0) | Create a DATETIME column with optional fractional seconds. |
| timestamp(name, fsp = 0) | Create a TIMESTAMP column with optional fractional seconds. |
| time(name, fsp = 0) | Create a TIME column with optional fractional seconds. |
| year(name) | Create a YEAR column. |
| char(name, length = 1) | Create a fixed length CHAR column. |
| string(name, length = 255) | Alias of VARCHAR, create variable length string column. |
| varchar(name, length = 255) | Create a VARCHAR column with given length. |
| tinyText(name) | Create a TINYTEXT column for short text. |
| text(name) | Create a TEXT column for standard text. |
| mediumText(name) | Create a MEDIUMTEXT column for larger text. |
| longText(name) | Create a LONGTEXT column for very large text. |
| binary(name, length = 1) | Create a fixed length binary column. |
| varBinary(name, length = 255) | Create a variable length binary column. |
| tinyBlob(name) | Create a TINYBLOB column for small binary data. |
| blob(name) | Create a BLOB column for binary data. |
| mediumBlob(name) | Create a MEDIUMBLOB column for larger binary data. |
| longBlob(name) | Create a LONGBLOB column for very large binary data. |
| json(name) | Create a JSON column to store structured data. |
| geometry(name) | Create a GEOMETRY column for spatial data. |
| point(name) | Create a POINT column to store a coordinate. |
| lineString(name) | Create a LINESTRING column for a line. |
| polygon(name) | Create a POLYGON column for shapes. |
| multiPoint(name) | Create a MULTIPOINT column for multiple coordinates. |
| multiLineString(name) | Create a MULTILINESTRING column for multiple lines. |
| multiPolygon(name) | Create a MULTIPOLYGON column for multiple shapes. |
| geometryCollection(name) | Create a GEOMETRYCOLLECTION column for mixed geometry types. |
| enum(name, ...values) | Create an ENUM column with predefined values. |
| increments(name = "id") | Create an auto increment UNSIGNED INT primary key. |
| bigIncrements(name = "id") | Create an auto increment UNSIGNED BIGINT primary key. |
| timestamps() | Add created_at and updated_at timestamp columns. |
| uniqueComposite(...cols) | Create a composite UNIQUE constraint across columns. |
| primaryComposite(...cols) | Create a composite PRIMARY KEY across columns. |
| addIndex(cols, name = null) | Create a standard index on one or more columns. |
| fullText(cols, name = null) | Create a FULLTEXT index for text search. |
| spatialIndex(cols, name = null) | Create a SPATIAL index for spatial columns. |
| engine(name) | Set the storage engine for the table. |
| charset(charset) | Set the default character set for the table. |
| collate(c) | Set the collation for the table. |
| comment(text) | Add a comment to the table. |
| _addColumn(name, type) | Internal method to register a column in the table. |
| toSQL() | Generate the full CREATE TABLE SQL statement. |


 