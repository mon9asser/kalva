# Kalva CLI Documentation

Kalva is a Node.js framework for building backend applications with a structured architecture and a simple command-line interface.

---

## Installation & Project Setup

### Create a New Project

```bash
kalva create-project <project-name>
```

This is the starting point. It will interactively prompt you to:
1. Choose a database (currently only **MySQL** is supported)
2. Enter your database connection details

It then scaffolds the full project structure, creates a `.env` file, and runs `npm install` automatically.

**Example:**
```bash
kalva create-project my-app
```

**Generated project structure:**
```
my-app/
├── app/
│   ├── raw/
│   └── builder.js
├── core/
│   ├── helper.js
│   └── server.js
├── database/
│   ├── connection.js
│   ├── model.js
│   ├── query-builder.js
│   └── schema.js
├── routes/
│   ├── api/
│   └── web/
├── .env
└── package.json
```

> ⚠️ All other commands must be run **inside** the project directory.

---

## Database Migrations (Tables)

### Create a Migration File

```bash
kalva create-table <table-name>
```

Creates a new migration file in `app/raw/` and registers it in `app/builder.js`.

```bash
kalva create-table users
```

---

### Update a Table (Add Column Migration)

```bash
kalva update-table <table-name>
```

Creates an update migration file for an existing table.

```bash
kalva update-table users
```

---

### Drop a Table (Drop Migration)

```bash
kalva drop-table <table-name>
```

Creates a drop migration file for the specified table.

```bash
kalva drop-table users
```

---

### Run Pending Migrations

```bash
kalva build-tables
```

Executes all pending (unbuilt) migration files by running `app/builder.js`. Only migrations with `status: false` are executed.

---

### Delete a Migration File

```bash
kalva delete-table <table-name>
```

Removes the migration file from `app/raw/` and unregisters it from `app/builder.js` and `package.json`.

```bash
kalva delete-table users
```

---

## Models

### Create a Model

```bash
kalva create-model <model-name>
```

Creates a new model file at `app/models/<name>-model.js`.

```bash
kalva create-model user
# Creates: app/models/user-model.js
# Exports:  UserModel
```

---

### Delete a Model

```bash
kalva delete-model <model-name>
```

Removes the model file and its entry from `package.json`.

```bash
kalva delete-model user
```

---

## Controllers

### Create a Controller

```bash
kalva create-controller <controller-name>
```

Creates a new controller file at `app/controllers/<name>-controller.js`.

```bash
kalva create-controller user
# Creates: app/controllers/user-controller.js
# Exports:  UserController
```

---

### Delete a Controller

```bash
kalva delete-controller <controller-name>
```

Removes the controller file and its entry from `package.json`.

```bash
kalva delete-controller user
```

---

## Services

### Create a Service

```bash
kalva create-service <service-name>
```

Creates a new service file at `app/services/<name>-service.js`.

```bash
kalva create-service user
# Creates: app/services/user-service.js
# Exports:  UserService
```

---

### Delete a Service

```bash
kalva delete-service <service-name>
```

Removes the service file and its entry from `package.json`.

```bash
kalva delete-service user
```

---

## Middlewares

### Create a Middleware

```bash
kalva create-middleware <middleware-name>
```

Creates a new middleware file at `app/middlewares/<name>-middleware.js`.

```bash
kalva create-middleware auth
# Creates: app/middlewares/auth-middleware.js
```

---

### Delete a Middleware

```bash
kalva delete-middleware <middleware-name>
```

Removes the middleware file and its entry from `package.json`.

```bash
kalva delete-middleware auth
```

---

## Routes

### Create a Web Route File

```bash
kalva create-web <name>
```

Creates a new web route file at `routes/web/<name>.js`.

```bash
kalva create-web user
# Creates: routes/web/user.js
```

---

### Delete a Web Route File

```bash
kalva delete-web <name>
```

```bash
kalva delete-web user
```

---

### Create an API Route File

```bash
kalva create-api <name>
```

Creates a new API route file at `routes/api/<name>.js`.

```bash
kalva create-api user
# Creates: routes/api/user.js
```

---

### Delete an API Route File

```bash
kalva delete-api <name>
```

```bash
kalva delete-api user
```

---

## Resources (Bulk Generation)

### Create a Resource

```bash
kalva create-resource <name>
```

A shortcut that generates three files at once:
- `app/models/<name>-model.js`
- `app/services/<name>-service.js` (linked to the model)
- `app/controllers/<name>-controller.js` (linked to the service)

```bash
kalva create-resource product
```

---

### Delete a Resource

```bash
kalva delete-resource <name>
```

Removes all resource files (model, service, controller) associated with the given name.

```bash
kalva delete-resource product
```

---

## Reset

```bash
kalva reset [type]
```

Resets project files. If no type is provided, defaults to `all`.

| Type       | Description                        |
|------------|------------------------------------|
| `all`      | Resets all tables (migrations)     |
| `tables`   | Resets migration files only        |

```bash
kalva reset
kalva reset tables
```

> ⚠️ This deletes migration files from `app/raw/` and cleans up `app/builder.js` and `package.json`. Use with caution.

---

## Quick Reference

| Command                              | Description                                      |
|--------------------------------------|--------------------------------------------------|
| `kalva create-project <name>`        | Scaffold a new Kalva project                     |
| `kalva create-table <name>`          | Create a migration file                          |
| `kalva update-table <name>`          | Create an update migration                       |
| `kalva drop-table <name>`            | Create a drop migration                          |
| `kalva build-tables`                 | Run all pending migrations                       |
| `kalva delete-table <name>`          | Delete a migration file                          |
| `kalva create-model <name>`          | Create a model                                   |
| `kalva delete-model <name>`          | Delete a model                                   |
| `kalva create-controller <name>`     | Create a controller                              |
| `kalva delete-controller <name>`     | Delete a controller                              |
| `kalva create-service <name>`        | Create a service                                 |
| `kalva delete-service <name>`        | Delete a service                                 |
| `kalva create-middleware <name>`     | Create a middleware                              |
| `kalva delete-middleware <name>`     | Delete a middleware                              |
| `kalva create-web <name>`            | Create a web route file                          |
| `kalva delete-web <name>`            | Delete a web route file                          |
| `kalva create-api <name>`            | Create an API route file                         |
| `kalva delete-api <name>`            | Delete an API route file                         |
| `kalva create-resource <name>`       | Create model + service + controller at once      |
| `kalva delete-resource <name>`       | Delete model + service + controller              |
| `kalva reset [type]`                 | Reset project files (tables, all)                |

---

## Notes

- All commands (except `create-project`) must be run from **inside a Kalva project directory** — one that contains a `package.json` with `"project_type": "kalva"`.
- Currently, **MySQL** is the only supported database driver.
- Kalva tracks all generated files inside `package.json` under the `kalva_data` array.