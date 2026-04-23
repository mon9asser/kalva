#!/usr/bin/env node

const chalk = require("chalk");
const {execSync} = require('child_process');
const { program } = require("commander");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");
const { db_questions } = require('./.build/questions');
const { kalva_print } = require('./.build/print');

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

        program
            .command('check <project-name>')
            .action(async name => {
                
                this.project_name = name;
                this.current_db = 'mysql';
                await this.database_files( );
                

            });

        /*
          var is_in_dir = this.is_project_director();
                if( ! is_in_dir ) {
                    return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
                }
                
                this.project_name = name; 
        */
        // => Create Resource 
        // => Create Schema
        // => Create Model
        // => Create Service
        // => Create Controller 
        // => Create Api 
        // => Create View Layer withing the Front-End Framework

        // => Create CMS/E-Commerce/etc with one setup command
        program.parse();

    }

    is_project_director() {
        
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");

        if (!fs.existsSync(packageFile)) {
            return false;
        }

        const packageJson = JSON.parse(
            fs.readFileSync(packageFile, "utf8")
        );

        if (!packageJson.name) {
            return false;
        }

        if ( !packageJson.project_type || packageJson.project_type !== "kalva" ) {
            return false;
        }

        return true;

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
                project_type: "kalva",
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

        // create other dependecies
        await this.other_dependencies()

        // check the drive is already installed on you OS
        var isDriveExists = await this.check_database_version();

        if( isDriveExists.is_error ) {
            console.log('\n', chalk.red.bold(  '🚫 ' + isDriveExists.message), '\n');  
        }

        // Fill database information
        await this.database_questions();

        // create project files
        await this.json_package_setup();

        // Create database files
        await this.database_files();

        // install
        await this.install_packages();
    }

    async create_sqlite(){
        this.dependencies['sqlite3'] = "^6.0.1";
        this.database_version_command = 'sqlite3 --version';
        this.current_db = 'sqlite';
    }
    
    async other_dependencies() { 
        this.dependencies['dotenv'] = "^17.4.2";
        this.dependencies["chalk"]= "^4.1.2";
    }
    
    async create_mysql(){
        this.dependencies['mysql2'] = '^3.22.2';
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
                message: chalk.grey('Insert ') + chalk.hex('#596100').bold(question.title) + ' :',
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
                message: `The database driver of ${this.current_db} is not installed dont forget to install.`
            };
        }
    }

    async json_package_setup() {
        
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

 
    get_env_value(targetKey) {
       
        var proj_folder = path.join( process.cwd(), '/');

        var env = path.join(proj_folder, ".env");
        
        const content = fs.readFileSync(env, "utf8");
        const lines = content.split("\n");


        if( !fs.existsSync(env) ) {
            return console.log("Something went wrong!");
        }
        
        for (let line of lines) {
            line = line.trim();

            if (!line || line.startsWith("#")) {
                continue;
            }

            const [key, ...rest] = line.split("=");

            if (key === targetKey) {
                return rest.join("=").trim();
            }
        }

        return null;
    }
 
    async database_files() {   

        const proj_folder = path.join(process.cwd(), this.project_name);
        
        var env = path.join(proj_folder, ".env");

        if( !fs.existsSync(env) ) {
            return console.log("Something went wrong!");
        }

        
        var framework_client = path.join(proj_folder, "framework");
        if(! fs.existsSync(framework_client)) {
            fs.mkdirSync(framework_client);
        } 

        var framework_client = path.join(framework_client, "database");
        if(! fs.existsSync(framework_client)) {
            fs.mkdirSync(framework_client);
        } 
        
        var model_temp = {
            _from: path.join(__dirname, `.build`, `.temp`, `orm`, `model.${this.current_db}.txt`),
            _to:  path.join(framework_client, 'model.js')
        }
        var database_temp = {
            _from: path.join(__dirname, `.build`, `.temp`, `database`, `database.${this.current_db}.txt`),
            _to: path.join(framework_client, 'database.js')
        }
        var schema_temp = {
            _from: path.join(__dirname, `.build`, `.temp`, `schema`, `schema.${this.current_db}.txt`),
            _to: path.join(framework_client, 'schema.js')
        }
        
        if( ! fs.existsSync(database_temp._from) || !fs.existsSync(model_temp._from) || !fs.existsSync(schema_temp._from) ) {
            return console.log(`\n`,'🚫 ' , chalk.red.bold('Error: Template paths do not exist. Submit a ticket for this issue.'),`\n`);
        }
        
        
        // create model file
        fs.writeFileSync(
            model_temp._to,
            fs.readFileSync(model_temp._from, 'utf8')
        );

        // create datanase
        fs.writeFileSync(
            database_temp._to, 
            fs.readFileSync(database_temp._from, 'utf8')
        );
        // crate schema file 
        fs.writeFileSync(
            schema_temp._to,
            fs.readFileSync(schema_temp._from, 'utf8')
        );

        
    }
    
    async install_packages() {
         
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
