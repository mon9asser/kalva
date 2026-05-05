#!/usr/bin/env node

const chalk = require("chalk");
const {execSync} = require('child_process');
const { program } = require("commander");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");
const { db_questions } = require('./build/system/questions');
const { kalva_print } = require('./build/system/print');


class RunTime {

    project_name= null;
    dependencies =  {};
    scripts = {};
    current_db = null;
    database_version_command = null; 
    is_run= true;  

 

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
            .command('create-table <table-name>')
            .description('Create a new migration file with the given name.')
            .action(async name => this.create_table(name));

        program
            .command('update-table <table-name>')
            .description('Update the migration file.')
            .action(async name => this.update_table(name));
        
        program
            .command('drop-table <table-name>')
            .description('Drop a table in a migration')
            .action(async name => this.drop_table(name));
        
        program
            .command('delete-table <table-name>')
            .description('Delete the migration file')
            .action(async name => this.delete_migration_table(name));
        
        program
            .command('build-tables')
            .description('Execute all pending migrations for the database')
            .action(async () => this.migrate_schema());
        
        program
            .command('create-model <model-name>')
            .description('Create a new model file with the given name')
            .action(async (name) => this.create_model(name));
        
        program
            .command('delete-model <model-name>')
            .description('Remove model file with the given name')
            .action(async (name) => this.delete_model(name));
        
        program
            .command('create-controller <controller-name>')
            .description('Create a new controller file with the given name')
            .action(async (name) => this.create_controller(name));

        program
            .command('delete-controller <controller-name>')
            .description('Remove controller file with the given name')
            .action(async (name) => this.delete_controller(name));
        
        program
            .command('create-service <service-name>')
            .description('Create a new service file with the given name')
            .action(async (name) => this.create_service(name));

        program
            .command('delete-service <service-name>')
            .description('Remove service file with the given name')
            .action(async (name) => this.delete_service(name));
        
        program
            .command('create-middleware <service-name>')
            .description('Create a new middleware file with the given name')
            .action(async (name) => this.create_middleware(name));

        program
            .command('delete-middleware <service-name>')
            .description('Remove middleware file with the given name')
            .action(async (name) => this.delete_middleware(name));
        
        program
            .command('create-resource <service-name>')
            .description('Create resource files with the given name')
            .action(async (name) => this.create_resource(name));
        
        program
            .command('delete-resource <service-name>')
            .description('Remove resource files with the given name')
            .action(async (name) => this.delete_resource(name));

        program
            .command('create-web <service-name>')
            .description('Create web api files with the given name')
            .action(async (name) => this.create_web(name));
        
        program
            .command('delete-web <service-name>')
            .description('Remove web api files with the given name')
            .action(async (name) => this.delete_web(name));
        
        program
            .command('create-api <service-name>')
            .description('Create api files with the given name')
            .action(async (name) => this.create_api(name));
        
        program
            .command('delete-api <service-name>')
            .description('Remove api files with the given name')
            .action(async (name) => this.delete_api(name));

        program
            .command('reset [type]')
            .description('Rset kalva project files such as tables, models, controllers, service, etc')
            .action(async (type = 'all') => this.reset_project(type));

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

    async create_resource(name, file_type = 'create') {
        
        this.create_model(name, file_type);
        this.create_service(name, file_type, true);
        this.create_controller(name,file_type, true);
         

    }

    async delete_web(web_name) {
        
        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == web_name && x.type.includes('-web'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no web in the project with that name: ${web_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "routes");
        var web_folder = path.join(app_directory, "web");
        access_array.forEach(web_object => {
            var web_file = path.join(web_folder, web_object.name);
            
            // unlink file 
            if( fs.existsSync(web_file) ) {
                fs.unlinkSync(web_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== web_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
    }

    async create_web( name, file_type = 'create', link_to_model = false ) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name.charAt(0).toUpperCase() + name.slice(1)}`; 
        var file_name = `${name}.js`;
        
        var routes_directory = path.join(projectDir, "routes");
        if( ! fs.existsSync(routes_directory) ) {
            fs.mkdirSync(routes_directory)
        }

        var web_directory = path.join(routes_directory, "web");
        if( ! fs.existsSync(web_directory) ) {
            fs.mkdirSync(web_directory)
        }
        
        var web_template = path.join(__dirname, "build", `templates`, 'new-web.txt');

        if( ! fs.existsSync(web_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var web_template_content = fs.readFileSync(web_template, 'utf8')
            .replaceAll('PLACEHOLDER_API_NAME', class_name);
        
        if( link_to_model ) {
            var required_model = `var {${name.charAt(0).toUpperCase() + name.slice(1)}Model} = require('./../models/${name}-model');\n`;
            web_template_content = required_model + web_template_content;
        }

        var web_file = path.join(web_directory, file_name);

        if(fs.existsSync(web_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The web of ${name} already exists!`),`\n`);
        }

        try {
            
            fs.writeFileSync(web_file, web_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-web`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The web ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }



    async delete_api(api_name) {
        
        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == api_name && x.type.includes('-api'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no api in the project with that name: ${api_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "routes");
        var api_folder = path.join(app_directory, "api");
        access_array.forEach(api_object => {
            var api_file = path.join(api_folder, api_object.name);
            
            // unlink file 
            if( fs.existsSync(api_file) ) {
                fs.unlinkSync(api_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== api_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
    }

    async create_api( name, file_type = 'create', link_to_model = false ) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name.charAt(0).toUpperCase() + name.slice(1)}`; 
        var file_name = `${name}.js`;
        
        var routes_directory = path.join(projectDir, "routes");
        if( ! fs.existsSync(routes_directory) ) {
            fs.mkdirSync(routes_directory)
        }

        var api_directory = path.join(routes_directory, "api");
        if( ! fs.existsSync(api_directory) ) {
            fs.mkdirSync(api_directory)
        }
        
        var api_template = path.join(__dirname, "build", `templates`, 'new-api.txt');

        if( ! fs.existsSync(api_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var api_template_content = fs.readFileSync(api_template, 'utf8')
            .replaceAll('PLACEHOLDER_API_NAME', class_name);
        
        if( link_to_model ) {
            var required_model = `var {${name.charAt(0).toUpperCase() + name.slice(1)}Model} = require('./../models/${name}-model');\n`;
            api_template_content = required_model + api_template_content;
        }

        var api_file = path.join(api_directory, file_name);

        if(fs.existsSync(api_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The api of ${name} already exists!`),`\n`);
        }

        try {
            
            fs.writeFileSync(api_file, api_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-api`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The api ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }



    async create_service(name, file_type = 'create', link_to_model = false) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name.charAt(0).toUpperCase() + name.slice(1)}Service`; 
        var file_name = `${name}-service.js`;
        
        var app_directory = path.join(projectDir, "app");
        if( ! fs.existsSync(app_directory) ) {
            fs.mkdirSync(app_directory)
        }

        var service_directory = path.join(app_directory, "services");
        if( ! fs.existsSync(service_directory) ) {
            fs.mkdirSync(service_directory)
        }
        
        var service_template = path.join(__dirname, "build", `templates`, 'new-service.txt');

        if( ! fs.existsSync(service_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var service_template_content = fs.readFileSync(service_template, 'utf8')
            .replaceAll('PLACEHOLDER_SERVICE_NAME', class_name);
        
        if( link_to_model ) {
            var required_model = `var {${name.charAt(0).toUpperCase() + name.slice(1)}Model} = require('./../models/${name}-model');\n`;
            service_template_content = required_model + service_template_content;
        }

        var service_file = path.join(service_directory, file_name);

        if(fs.existsSync(service_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The service of ${name} already exists!`),`\n`);
        }

        try {
            
            fs.writeFileSync(service_file, service_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-service`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The service ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }

    async create_middleware(name, file_type = 'create', link_to_model = false) {
        
        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name}`; 
        var file_name = `${name}-middleware.js`;
        
        var app_directory = path.join(projectDir, "app");
        if( ! fs.existsSync(app_directory) ) {
            fs.mkdirSync(app_directory)
        }

        var middleware_directory = path.join(app_directory, "middlewares");
        if( ! fs.existsSync(middleware_directory) ) {
            fs.mkdirSync(middleware_directory)
        }
        
        var middleware_template = path.join(__dirname, "build", `templates`, 'new-middleware.txt');

        if( ! fs.existsSync(middleware_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var middleware_template_content = fs.readFileSync(middleware_template, 'utf8')
            .replaceAll('PLACEHOLDER_MIDDLEWARE', class_name);
        
        if( link_to_model ) {
            var required_model = `var {${name.charAt(0).toUpperCase() + name.slice(1)}Model} = require('./../models/${name}-model');\n`;
            middleware_template_content = required_model + middleware_template_content;
        }

        var middleware_file = path.join(middleware_directory, file_name);

        if(fs.existsSync(middleware_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The middleware of ${name} already exists!`),`\n`);
        }

        try {
            
            fs.writeFileSync(middleware_file, middleware_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-middleware`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The middleware ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }

    async delete_middleware(middleware_name) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == middleware_name && x.type.includes('-middleware'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no middleware in the project with that name: ${middleware_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "app");
        var middleware_folder = path.join(app_directory, "middlewares");
        access_array.forEach(middleware_object => {
            var middleware_file = path.join(middleware_folder, middleware_object.name);
            
            // unlink file 
            if( fs.existsSync(middleware_file) ) {
                fs.unlinkSync(middleware_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== middleware_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
    }

    async delete_service(service_name) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == service_name && x.type.includes('-service'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no service in the project with that name: ${service_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "app");
        var service_folder = path.join(app_directory, "services");
        access_array.forEach(service_object => {
            var service_file = path.join(service_folder, service_object.name);
            
            // unlink file 
            if( fs.existsSync(service_file) ) {
                fs.unlinkSync(service_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== service_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
        

    }

    async delete_controller(controller_name) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == controller_name && x.type.includes('-controller'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no controller in the project with that name: ${controller_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "app"); 
        var controller_folder = path.join(app_directory, "controllers");
        access_array.forEach(controller_object => {
            var controller_file = path.join(controller_folder, controller_object.name);
             
            // unlink file 
            if( fs.existsSync(controller_file) ) {
                fs.unlinkSync(controller_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== controller_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
        

    }

    async delete_model(model_name) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        var data_array = json_content.kalva_data;
        var access_array = data_array.filter(x => x.access_name == model_name && x.type.includes('-model'));
        if( ! access_array.length ) {
            return console.log('\n', chalk.red.bold(`There is no model in the project with that name: ${model_name}.`) ,'\n');
        }

        var app_directory = path.join(projectDir, "app"); 
        var model_folder = path.join(app_directory, "models");
        access_array.forEach(model_object => {
            var model_file = path.join(model_folder, model_object.name);
            
            // unlink file 
            if( fs.existsSync(model_file) ) {
                fs.unlinkSync(model_file);
            } 
            
            // delete from 
            json_content.kalva_data = json_content.kalva_data.filter(x => x.created_at !== model_object.created_at)
            
        }); 

        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
        

    }

    async delete_migration_table(name) {

        try {

            var isProjectDir = this.is_project_director();
            if( !isProjectDir ) {
                return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
            } 

            // get information about that table from JSON file
            const projectDir = process.cwd();
            const packageFile = path.join(projectDir, "package.json");
            var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
            var data_array = json_content.kalva_data;
            var access_array = data_array.filter(x => x.access_name == name && x.type.includes('-table'));
            var table_folder = path.join(projectDir, "app", "raw");
            const builderJs = path.join(projectDir, "app", "builder.js");
            access_array.forEach(table => { 


            var file = path.join(table_folder, table.name);
            
            var timestamp = table.name.split("-")[0]; 
            var tble_name = table.access_name.charAt(0).toUpperCase() + table.access_name.slice(1); 
            var name_variable = `${tble_name}Schema${timestamp}`;
            
            
            var builder_content = fs.readFileSync(builderJs, 'utf8');


            const regexRequire = new RegExp(
                `var\\s+\\{\\s*${name_variable}\\s*\\}\\s*=\\s*require\\([^)]*\\);?`,
                "g"
            );
            const regexBuilder = new RegExp(`\\b${name_variable}\\b`, "g");
            builder_content = builder_content
                .replace(regexRequire, "")   // remove require line
                .replace(regexBuilder, "")   // remove variable usage
                .replace(/,\s*,/g, ",")
                .replace(/\[\s*,/g, "[")
                .replace(/,\s*\]/g, "]"); 

            fs.writeFileSync(builderJs, builder_content.trim()); 
            if( fs.existsSync(file) ) {
                fs.unlinkSync(file);
            } 
            
        })


        var data_kalva = json_content.kalva_data.filter(elem => {
            var findIndex = access_array.findIndex( x => x.name === elem.name);
            if( findIndex === -1 ) {
                return elem
            }
        });

        json_content.kalva_data = data_kalva;
        
        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
        
        console.log('\n', chalk.green.bold(`The migration file for the table ${name} has been deleted successfully.`) ,'\n');

        } catch (error) {
            console.log('\n', chalk.red.bold(`🚫 Error: ${error.message}"`) ,'\n');
        }


    }

    async create_controller(name, file_type = 'create', link_to_model = false) {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name.charAt(0).toUpperCase() + name.slice(1)}Controller`; 
        var file_name = `${name}-controller.js`;

        var app_directory = path.join(projectDir, "app");
        if( ! fs.existsSync(app_directory) ) {
            fs.mkdirSync(app_directory)
        }

        var controller_directory = path.join(app_directory, "controllers");
        if( ! fs.existsSync(controller_directory) ) {
            fs.mkdirSync(controller_directory)
        }
        
        var controller_template = path.join(__dirname, "build", `templates`, 'new-controller.txt');

        if( ! fs.existsSync(controller_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var controller_template_content = fs.readFileSync(controller_template, 'utf8')
            .replaceAll('PLACEHOLDER_CONTROLLER_NAME', class_name);
        
        if( link_to_model ) {
            var required_model = `var {${name.charAt(0).toUpperCase() + name.slice(1)}Service} = require('./../services/${name}-service');\n`;
            controller_template_content = required_model + controller_template_content;
        }

        var controller_file = path.join(controller_directory, file_name);

        if(fs.existsSync(controller_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The controller of ${name} already exists!`),`\n`);
        }


        try {
            
            fs.writeFileSync(controller_file, controller_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-controller`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The controller ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }


    async create_model(name, file_type = 'create') {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        // Create a folder 
        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 

        var class_name = `${name.charAt(0).toUpperCase() + name.slice(1)}Model`; 
        var file_name = `${name}-model.js`;

        var app_directory = path.join(projectDir, "app");
        if( ! fs.existsSync(app_directory) ) {
            fs.mkdirSync(app_directory)
        }

        var model_directory = path.join(app_directory, "models");
        if( ! fs.existsSync(model_directory) ) {
            fs.mkdirSync(model_directory)
        }
        
        var model_template = path.join(__dirname, "build", `templates`, 'new-model.txt');

        if( ! fs.existsSync(model_template) ) {
            return console.log('\n', chalk.red.bold('You may change the database driver in your .env file. Please reinstall the framework.'), '\n');
        }
        
        var model_template_content = fs.readFileSync(model_template, 'utf8')
            .replaceAll('PLACEHOLDER_MODEL_NAME', class_name)
            .replaceAll('PLACEHOLDER_TABLE_NAME', name);
               

        var model_file = path.join(model_directory, file_name);

        if(fs.existsSync(model_file)) {
            return console.log(`\n`,chalk.yellow.bold(`The model of ${name} already exists!`),`\n`);
        }

        try {
            
            fs.writeFileSync(model_file, model_template_content, 'utf8');

            json_content.kalva_data.push({
                name: file_name,
                type: `${file_type}-model`,
                access_name: name,
                created_at: Date.now(),
                status: true
            })

            fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
            // add object to json package
            
            
            console.log('\n', chalk.green.bold(`The model ${class_name} has been created successfully.`), '\n');
        } catch (err) {
            console.log("Error:", err.message);
        }
    }

    async migrate_schema() {

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");
        
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        const filtered = json_content.kalva_data.filter(item => item.type.includes('table') && !item.status );

        if( !filtered.length ) {
            return console.log('\n', chalk.red.bold(`There are no migrations to run.`) ,'\n');
        }

        console.log('\n', chalk.yellow.bold(`Building ${filtered.length} Tables ...`) ,'\n');      

        execSync(`node app/builder.js`, { stdio: "inherit" });
        

    }

    async reset_tables() {

        const projectDir = process.cwd();
        const packageFile = path.join(projectDir, "package.json");

        const builderJs = path.join(projectDir, "app", "builder.js");
        
        var json_content = JSON.parse(fs.readFileSync(packageFile, 'utf8')); 
        const filtered = json_content.kalva_data.filter(item => item.type.includes('table'));

        var table_folder = path.join(projectDir, "app", "raw");
        filtered.forEach(table => {
            var file = path.join(table_folder, table.name);
            
            //
            var timestamp = table.name.split("-")[0]; 
            var tble_name = table.access_name.charAt(0).toUpperCase() + table.access_name.slice(1); 
            var name_variable = `${tble_name}Schema${timestamp}`;
            
            
            var builder_content = fs.readFileSync(builderJs, 'utf8');


            const regexRequire = new RegExp(
                `var\\s+\\{\\s*${name_variable}\\s*\\}\\s*=\\s*require\\([^)]*\\);?`,
                "g"
            );
            const regexBuilder = new RegExp(`\\b${name_variable}\\b`, "g");
            builder_content = builder_content
                .replace(regexRequire, "")   // remove require line
                .replace(regexBuilder, "")   // remove variable usage
                .replace(/,\s*,/g, ",")
                .replace(/\[\s*,/g, "[")
                .replace(/,\s*\]/g, "]"); 

            fs.writeFileSync(builderJs, builder_content.trim());

             
            if( fs.existsSync(file) ) {
                fs.unlinkSync(file);
            } 
        });
         
        var data_kalva = json_content.kalva_data.filter(elem => {
            var findIndex = filtered.findIndex( x => x.name === elem.name);
            if( findIndex === -1 ) {
                return elem
            }
        });

        json_content.kalva_data = data_kalva;
        
        fs.writeFileSync(packageFile, JSON.stringify(json_content, null, 2), 'utf8');
        
    }


    async reset_project(type) {

        /**
         * type is
         * - all
         * - tables
         * - resources
         * - models
         * - controllers
         * - services
         */

        var isProjectDir = this.is_project_director();
        if( !isProjectDir ) {
            return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
        } 
        
        switch (type) {

            case 'all':
                await this.reset_tables();
                break;

            case 'tables':
                await this.reset_tables();
                break;
            
            case 'resources':
                break;

            case 'models':
                break;

            case 'controllers':
                break;
            
            case 'services':
                break;
        
            default:
                console.log('\n', chalk.red.bold(`🚫 Error: There is no command with "reset ${type}"`) ,'\n');
                break;
        }
        
        
    }

    async create_migration_file( table_name, template_contents = 'new-schema', file_type = 'create' ) {
        
        var name = table_name.toLowerCase();

        try {
            const tablePath = path.join(process.cwd(), "/app/raw");

            const builderPath = path.join(process.cwd(), "/app/builder.js");

            var database_type = this.get_env_value('DATABASE_DRIVER');

            const templatePath = path.join(__dirname, `/build/templates/${database_type}/${template_contents}.txt`);

            // create name for that file
            var file_name = `${Date.now()}-${file_type}-${name}-table.js`;
            var timestamp = Date.now();
            const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

            var file_content = fs.readFileSync(templatePath, 'utf-8')
                .replaceAll("SCHEMA_PLACEHOLDER", `${capitalizedName}Schema${timestamp}`)
                .replaceAll("TABLE_PLACEHOLDER", name);

            
            // Append Data to JSON Package
            var file_json = {
                name: file_name,
                type: `${file_type}-table`,
                access_name: name,
                created_at: Date.now(),
                status: false
            }


            var json_package_file = path.join(process.cwd(), "/package.json");
            var package_json = JSON.parse(fs.readFileSync(json_package_file, 'utf-8')); 

            var checkJsonData = package_json.kalva_data.findIndex(x => x.type == file_json.type &&  x.access_name == file_json.access_name )
            if( checkJsonData !== -1 ) {
                console.log(`\n`,chalk.red.bold(`🚫 You already created the raw file for that table: ${name}`),`\n`);
                return false;
            }

            package_json.kalva_data.push(file_json);
            fs.writeFileSync(
                json_package_file,
                JSON.stringify(package_json, null, 2),
                "utf-8"
            );
            
            // Create file in the path
            fs.writeFileSync(
                `${tablePath}/${file_name}`,
                file_content,
                "utf-8"
            );

            var schemaName = `${capitalizedName}Schema${timestamp}`;

            var require_code = `var { PLACEHOLDER_FUN_NAME } = require("./raw/PLACEHOLDER_FILE_NAME");`
                .replace('PLACEHOLDER_FUN_NAME', schemaName)
                .replace('PLACEHOLDER_FILE_NAME', file_name)
                

            var builder_content = fs.readFileSync(builderPath, 'utf-8')
                .replace(
                    /var\s+builder\s*=\s*\[([\s\S]*?)\];/,
                    (match, inside) => {

                        let items = inside
                            .split(',')
                            .map(x => x.trim())
                            .filter(Boolean);

                        if (!items.includes(schemaName)) {
                            items.push(schemaName);
                        }

                        return `var builder = [\n    ${items.join(',\n    ')}\n];`;
                    }
                );
            

            var check_part = `var { ${schemaName} }`;
          
            var new_builder_content = ( builder_content.indexOf(check_part) !== -1 ) ? builder_content:  require_code +  '\n' +builder_content;

            fs.writeFileSync(builderPath, new_builder_content);

            return file_name;
        } catch (error) {
            return false
        }
    }

    async create_table(name) {

       try {

            var isProjectDir = this.is_project_director();
            if( !isProjectDir ) {
                return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
            } 
             
            var file_name = await this.create_migration_file(name, 'new-schema',  'create' );

            if( file_name )
                console.log("\n", '💡', chalk.green.bold(`The raw update table has been created successfully: ${file_name}`) ,"\n");
            

       } catch (error) {
            console.log('\n',chalk.red.bold(`Error: ${error.message}`),'\n');
       }

    }

    async drop_table(name) {

         try {

                var isProjectDir = this.is_project_director();
                if( !isProjectDir ) {
                    return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
                } 
                
                var file_name = await this.create_migration_file(name, 'drop-schema',  'drop' );

                if( file_name )
                    console.log("\n", '💡', chalk.green.bold(`The raw of drop table has been created successfully: ${file_name}`) ,"\n");
                

        } catch (error) {
                console.log('\n',chalk.red.bold(`Error: ${error.message}`),'\n');
        }

    }

    async update_table(name) {
        try {

                var isProjectDir = this.is_project_director();
                if( !isProjectDir ) {
                    return console.log(`${chalk.red.bold('Error')}: This ${chalk.yellow.bold(process.cwd())} is not a Kalva project directory. Please make sure you run this command inside the installed project directory!`);
                } 
                
                var file_name = await this.create_migration_file(name, 'update-schema',  'update' );

                if( file_name )
                    console.log("\n", '💡', chalk.green.bold(`The raw table of update has been created successfully: ${file_name}`) ,"\n");
                

        } catch (error) {
                console.log('\n',chalk.red.bold(`Error: ${error.message}`),'\n');
        }
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
                kalva_data: [],
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
                choices: [ "mysql", "others" ] // [ "sqlite", "postgres", "mongodb"]
            },
        ]);

        

        switch(answer.database) {
            case 'mysql':
                await this.create_mysql();
                break;
            case 'others':
                await this.show_sorry_message();
                break;
            /*
            case 'sqlite':
                await this.create_sqlite();
                break;
            case 'postgres':
                await this.create_postgres();
                break;
            case 'mongodb':
                await this.create_mongodb();
                break;
            */
        }

        if( this.is_run === false ) {
            return;
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

    show_sorry_message () {
        this.is_run = false;
        return console.log('\n',chalk.red.bold("Unfortunately, MySQL is the only supported database for now.", '\n'));
    }

    async create_sqlite(){
        this.dependencies['sqlite3'] = "^6.0.1";
        this.database_version_command = 'sqlite3 --version';
        this.current_db = 'sqlite';
    }
    
    async other_dependencies() { 
        this.dependencies['dotenv']  = "^17.4.2";
        this.dependencies["chalk"]   = "^4.1.2";
        this.dependencies["express"] = "^5.2.1";
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


        var core_folder = path.join(proj_folder, "core");
        if(! fs.existsSync(core_folder)) {
            fs.mkdirSync(core_folder);
        } 
        

        var routes_folder = path.join(proj_folder, "routes");
        if(! fs.existsSync(routes_folder)) {
            fs.mkdirSync(routes_folder);
        } 

        var api_folder = path.join(routes_folder, "api");
        if(!fs.existsSync(api_folder)) {
            fs.mkdirSync(api_folder);
        }

        var web_folder = path.join(routes_folder, "web");
        if(!fs.existsSync(web_folder)) {
            fs.mkdirSync(web_folder);
        }
        
        var framework_client = path.join(proj_folder, "app");
        if(! fs.existsSync(framework_client)) {
            fs.mkdirSync(framework_client);
        } 

        var fdatabase_client = path.join(proj_folder, "database");
        if(! fs.existsSync(fdatabase_client)) {
            fs.mkdirSync(fdatabase_client);
        }  

        var fbuild_raw = path.join(framework_client, "raw");
        if(! fs.existsSync(fbuild_raw)) {
            fs.mkdirSync(fbuild_raw);
        }  

        var model_temp = {
            _from: path.join(__dirname, `build`, `${this.current_db}`, `model.txt`),
            _to:  path.join(fdatabase_client, 'model.js')
        }
        var database_temp = {
            _from: path.join(__dirname, `build`, `${this.current_db}`, `database.txt`),
            _to: path.join(fdatabase_client, 'connection.js')
        }
        var schema_temp = {
            _from: path.join(__dirname, `build`,`${this.current_db}`, `schema.txt`),
            _to: path.join(fdatabase_client, 'schema.js')
        } 
        var query_temp = {
            _from: path.join(__dirname, `build`,`${this.current_db}`, `query-builder.txt`),
            _to: path.join(fdatabase_client, 'query-builder.js')
        }

        var builder_temp = {
            _from: path.join(__dirname, `build`,`templates`, `builder.txt`),
            _to: path.join(framework_client, 'builder.js')
        } 


        var helper_temp = {
            _from: path.join(__dirname, `build`,`templates`,`core`, `helper.txt`),
            _to: path.join(core_folder, 'helper.js')
        } 

        var server_temp = {
            _from: path.join(__dirname, `build`,`templates`,`core`, `server.txt`),
            _to: path.join(core_folder, 'server.js')
        } 
        
        if( 
            ! fs.existsSync(database_temp._from)    || 
            ! fs.existsSync(model_temp._from)       || 
            ! fs.existsSync(schema_temp._from)      || 
            ! fs.existsSync(query_temp._from)       || 
            ! fs.existsSync(builder_temp._from)     ||
            ! fs.existsSync(helper_temp._from)      ||
            ! fs.existsSync(server_temp._from)     
        ) {
            return console.log(`\n`,'🚫 ' , chalk.red.bold('Error: Template paths do not exist. Submit a ticket for this issue.'),`\n`);
        }
        
        
        if( ! fs.existsSync(builder_temp._to) ) {
            fs.writeFileSync(
                builder_temp._to,
                fs.readFileSync(builder_temp._from, 'utf8')
            );
        } 

        fs.writeFileSync(
            model_temp._to,
            fs.readFileSync(model_temp._from, 'utf8')
        );
 
        fs.writeFileSync(
            database_temp._to, 
            fs.readFileSync(database_temp._from, 'utf8')
        ); 

        fs.writeFileSync(
            schema_temp._to,
            fs.readFileSync(schema_temp._from, 'utf8')
        );
 
        fs.writeFileSync(
            query_temp._to,
            fs.readFileSync(query_temp._from, 'utf8')
        );

        fs.writeFileSync(
            helper_temp._to,
            fs.readFileSync(helper_temp._from, 'utf8')
        );

        fs.writeFileSync(
            server_temp._to,
            fs.readFileSync(server_temp._from, 'utf8')
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
  
            console.log('\n', '>>', 'Run: '+ chalk.blue.bold("npm run dev"), '\n');     

        } catch (error) {
            console.log('\n', chalk.red("Error: Failed to install packages:", error.message), '\n');
            process.exit(1);
        }
    }

}


var cli = new RunTime();
