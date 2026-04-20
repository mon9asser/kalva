var db_questions  = [
    {
        name: 'sqlite',
        title: 'SQLite',
        questions: [
            {
                name: 'databas_file',
                title: 'Database File Name',
                value: 'database.db' // database.db
            }
        ]
    },
    {
        name: 'mysql',
        title: 'MySql',
        questions: [
            {
                name: 'databas_host',
                title: 'Database Host Name',
                value: 'localhost' 
            },
            {
                name: 'databas_user',
                title: 'Database User Name',
                value: 'root' 
            },
            {
                name: 'databas_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'database_name',
                title: 'Database Name',
                value: '' 
            } 
        ]
    },
    {
        name: 'postgres',
        title: 'PostGres',
        questions: [
            {
                name: 'databas_host',
                title: 'Database Host Name',
                value: 'localhost' 
            },
            {
                name: 'databas_user',
                title: 'Database User Name',
                value: 'root' 
            },
            {
                name: 'databas_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'database_name',
                title: 'Database Name',
                value: '' 
            } ,
            {
                name: 'databas_port',
                title: 'Database Port',
                value: 1024
            } 
        ]
    },
    {
        name: 'mongodb',
        title: 'MongoDB',
        questions: [
            {
                name: 'database_name',
                title: 'Database Name',
                value: '' 
            },
            {
                name: 'databas_user',
                title: 'Database User Name',
                value: '' 
            },
            {
                name: 'databas_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'databas_server_ip',
                title: 'IP',
                value: '127.0.0.1' 
            },
            {
                name: 'databas_port',
                title: 'Database port',
                value: 27017 
            }, 
            
        ]
    }
];


module.exports = {db_questions};
 
