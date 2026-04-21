var db_questions  = [
    {
        name: 'sqlite',
        title: 'SQLite',
        questions: [
            {
                name: 'database_file',
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
                name: 'database_host',
                title: 'Database Host Name',
                value: 'localhost' 
            },
            {
                name: 'database_user',
                title: 'Database User Name',
                value: 'root' 
            },
            {
                name: 'database_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'database_name',
                title: 'Database Name',
                value: '' 
            },

            {
                name: 'database_port',
                title: 'Database Port',
                value: 3306 
            },
        ]
    },
    {
        name: 'postgres',
        title: 'PostGres',
        questions: [
            {
                name: 'database_host',
                title: 'Database Host Name',
                value: 'localhost' 
            },
            {
                name: 'database_user',
                title: 'Database User Name',
                value: 'root' 
            },
            {
                name: 'database_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'database_name',
                title: 'Database Name',
                value: '' 
            } ,
            {
                name: 'database_port',
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
                name: 'database_user',
                title: 'Database User Name',
                value: '' 
            },
            {
                name: 'database_password',
                title: 'Database Password',
                value: '' 
            },
            {
                name: 'database_server_ip',
                title: 'IP',
                value: '127.0.0.1' 
            },
            {
                name: 'database_port',
                title: 'Database port',
                value: 27017 
            }, 
            
        ]
    }
];


module.exports = {db_questions};
 
