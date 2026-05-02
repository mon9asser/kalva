var {Schema} = require("./../build/schema");


// Orders 
(async ()=> {

    await Schema.create('users', (t) => {
        t.increments('id');

        t.string('name', 100).notNullable();
        t.string('email', 150).notNullable().unique();
        t.string('password', 255).notNullable();

        t.boolean('active').default(1);

        t.timestamps();
    });

    await Schema.create('orders', (t) => {
        t.increments('id');

        t.integer('user_id')
            .unsigned()
            .notNullable()
            .references('users', 'id', 'CASCADE', 'CASCADE');

        t.decimal('total_amount', 10, 2).notNullable();
        
        t.enum('status', ['pending', 'paid', 'cancelled'])
            .default('pending');

        t.timestamps();

        t.addIndex('user_id');
    });

    await Schema.create('transactions', (t) => {
        t.increments('id');

        t.integer('order_id')
            .unsigned()
            .notNullable()
            .references('orders', 'id', 'CASCADE', 'CASCADE');

        t.decimal('amount', 10, 2).notNullable();

        t.enum('payment_method', ['card', 'cash', 'wallet'])
            .notNullable();

        t.enum('status', ['pending', 'success', 'failed'])
            .default('pending');

        t.string('reference', 150).nullable();

        t.timestamps();

        t.addIndex('order_id');
    });

})();