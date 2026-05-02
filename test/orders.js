var { Model } = require("./../build/model");

class Order extends Model {
    static table = 'orders';
    static primary_key = 'id';

    static fillable = [
        'user_id',
        'total_amount',
        'status'
    ];

} 