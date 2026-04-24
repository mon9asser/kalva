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

here is the file `/blueprint/user.js`

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
..

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


## Framework Documentation 

### MongoDB Documentation 

### MySQL Documentation in Kalva  
- [Database Doc](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-database-documentation.md)
- [Blueprint Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-schema-documentation.md)
- [ORM & Query Builder](https://github.com/mon9asser/kalva/blob/master/docs/kalva-mysql-orm-documentation.md) 


### PostgreSQL Database Documentation 

### SQLite Database Documentation 
