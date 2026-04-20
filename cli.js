#!/usr/bin/env node

const chalk = require("chalk");
const {execSync} = require('child_process');
const { program } = require("commander");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");
const { db_questions } = require('./framework/questions');
const { kalva_print } = require('./framework/print');

class RunTime {

    project_name= null;
    dependencies =  {};
    scripts = {};
    current_db = null;
    database_version_command = null; 

    constructor() {
        
        // Run Commands  
        this.commands();
        
    }

    commands() { 

        program
            .name('kalva')
            .description('Kalva is a Node.js framework for building backend applications with a simple CLI and structured architecture')
            .version('1.0.0');

        // => Create Project 
        program
            .command('create-project <project-name>')
            .description('Create a new Kalva project with the given name')
            .action(async (name) => await this.installing(name));

        program.parse();

    }

    createPackageJson() {
        return {
                name: this.project_name,
                version: "1.0.0",
                description: `${this.project_name} based on Kalva Framework Project`,
                main: "server.js",
                type: "commonjs",
                scripts: this.scripts, 
                dependencies: this.dependencies,
                devDependencies: {},
                author: "",
                license: "MIT"
        };
    }

    async installing( name ) {
        this.project_name = name; 
        console.log( kalva_print );
        console.log('\n', '', chalk.yellowBright.bold("Fill the following information:"), '\n');

        // Choose the database
        const answer = await inquirer.prompt([
            {
                type: "list",
                name: "database",
                message: chalk.blue("Choose database:"),
                choices: ["sqlite", "mysql", "postgres", "mongodb"]
            },
        ]);

        switch(answer.database) {
            case 'sqlite':
                await this.create_sqlite();
                break;
            case 'mysql':
                await this.create_mysql();
                break;
            case 'postgres':
                await this.create_postgres();
                break;
            case 'mongodb':
                await this.create_mongodb();
                break;
        }

        // check the drive is already installed on you OS
        var isDriveExists = await this.check_database_version();

        if( isDriveExists.is_error ) {
            console.log('\n', chalk.red.bold(  '🚫' + isDriveExists.message), '\n'); 
            process.exit(0); 
        }

        // Fill database information
        await this.database_questions();

        // create project files
        await this.project_setup();

        // install
        await this.install_packages();
    }

    async create_sqlite(){
        this.dependencies['sqlite3'] = "^6.0.1";
        this.database_version_command = 'sqlite3 --version';
        this.current_db = 'sqlite';
    }
  
    async create_mysql(){
        this.dependencies['mysql2'] = '^2.18.1';
        this.database_version_command = 'mysql --version';
        this.current_db = 'mysql';
    }
  
    async create_postgres(){
        this.dependencies['pg'] = "^8.20.0";
        this.database_version_command = 'postgres --version';
        this.current_db = 'postgres';
    }
  
    async create_mongodb(){
        this.dependencies['mongoose'] = '^9.4.1';
        this.database_version_command = 'mongod --version';
        this.current_db = 'mongodb';
    }
    
    async database_questions() {
 
        var DbIndex = db_questions.findIndex(x => x.name == this.current_db);
        if( DbIndex == -1 ) {
            throw new Error("Something went wrong");
        }
        var list = db_questions[DbIndex];

        
        var user_answers = await inquirer.prompt(list.questions.map(question => {
           return {
                type: "input",
                name: question.name,
                message: chalk.grey('Insert ') + chalk.yellowBright(question.title) + ' :',
                default: question.value || ''
           }
        }));

        
        
        // create .env file 
        const projectPath = path.join(process.cwd(), this.project_name); 
        
        if(! fs.existsSync(projectPath))
            fs.mkdirSync(projectPath, { recursive: true });
        
        const envContent = Object.entries(user_answers)
            .map(([key, value]) => `${key.toUpperCase()}=${value}`)
            .join("\n");
        var all_content = `#Database Setting\nDATABASE_DRIVER=${list.name}\n${envContent}`;

        fs.writeFileSync(
            path.join(projectPath, ".env"),
            all_content
        );
         
    }

    async check_database_version() {
        try {
            const version = execSync(this.database_version_command).toString().trim();
            return {
                is_error: false,
                message: `The database driver of ${this.current_db} is already installed in your operating system.`
            };
        } catch (error) {
            return   {
                is_error: true,
                message: `The database driver of ${this.current_db} is not installed in your operating system. Please install then try again.`
            };
        }
    }

    async project_setup() {
        var jsonPackage = this.createPackageJson();
        var projectPath = path.join(process.cwd(), this.project_name);
        if(! fs.existsSync(projectPath))
            fs.mkdirSync(projectPath, { recursive: true });
        // fs.mkdirSync(projectPath);
        fs.writeFileSync(
            path.join(projectPath, "package.json"),
            JSON.stringify(jsonPackage, null, 2)
        );
    }
    
    async install_packages() {
        const { execSync } = require("child_process");
        const projectPath = path.join(process.cwd(), this.project_name);

        console.log("\n", "📦", chalk.cyan.bold(`Installing Kalva files and dependencies... `), '\n');

        try {
            execSync("npm install", {
                cwd: projectPath,
                stdio: "inherit"
            });

            console.log('\n', '🍺', chalk.green.bold("Kalva framework installed successfully!"), '\n'); 

        } catch (error) {
            console.log('\n', chalk.red("Error: Failed to install packages:", error.message), '\n');
            process.exit(1);
        }
    }

}


var cli = new RunTime();
