const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Testing Database Connection...');
console.log('Host:', process.env.DATABASE_HOST);
console.log('Port:', process.env.DATABASE_PORT);
console.log('User:', process.env.DATABASE_USERNAME);
console.log('Database:', process.env.DATABASE_NAME);
console.log('Password Length:', process.env.DATABASE_PASSWORD ? process.env.DATABASE_PASSWORD.length : '0');

const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
});

client.connect()
    .then(() => {
        console.log('Successfully connected to the database!');
        client.end();
    })
    .catch(err => {
        console.error('Connection error:', err.message);
        client.end();
    });
