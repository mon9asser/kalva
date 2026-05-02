var { Model } = require("./../build/model");

class User extends Model {
    static table = 'users';
    static primary_key = 'id';
    static fillable = ['name', 'email', 'password', 'active'];
}
