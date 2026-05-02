var { Model } = require("./../build/model");

class Transaction extends Model {
    static table = 'transactions';
    static primary_key = 'id';

    static fillable = [
        'order_id',
        'amount',
        'payment_method',
        'status',
        'reference'
    ];
}
 
 