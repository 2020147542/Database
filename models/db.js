const mysql = require('mysql');
require("dotenv").config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
    charset: 'utf8mb4',
})

connection.connect(function (err) {
    if (err) throw err;
    console.log('DB Connected');
});

module.exports = connection;