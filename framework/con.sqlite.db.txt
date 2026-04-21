const sqlite3 = require('sqlite3').verbose();
const { parsed } = require('dotenv').config();
const path = require('path');

class Database {

    static instance;
    static dbInstance;

    constructor() {

        if (Database.instance) {
            return Database.instance;
        }

        const dbPath = parsed?.DATABASE_FILE
            ? path.resolve(parsed.DATABASE_FILE)
            : path.resolve('database.sqlite');

        Database.dbInstance = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error("SQLite connection error:", err.message);
            }
        });

        Database.instance = this;
    }

    is_connected() {
        return Database.dbInstance ? true : false;
    }

    async query(sql, params = []) {
        try {

            if (!this.is_connected()) {
                throw new Error("Database connection error");
            }

            const isSelect = sql.trim().toLowerCase().startsWith('select');

            return await new Promise((resolve) => {

                if (isSelect) {

                    Database.dbInstance.all(sql, params, (err, rows) => {
                        if (err) {
                            return resolve({
                                is_error: true,
                                message: err.message,
                                data: []
                            });
                        }

                        resolve({
                            is_error: false,
                            message: "success",
                            data: rows
                        });
                    });

                } else {

                    Database.dbInstance.run(sql, params, function (err) {
                        if (err) {
                            return resolve({
                                is_error: true,
                                message: err.message,
                                data: []
                            });
                        }

                        resolve({
                            is_error: false,
                            message: "success",
                            data: {
                                lastID: this.lastID,
                                changes: this.changes
                            }
                        });
                    });

                }

            });

        } catch (error) {

            return {
                is_error: true,
                message: error.message,
                data: []
            };

        }
    }
}
 
module.exports = { Database };