const express = require('express')
const app = express()
const axios = require('axios')
const mysql = require('mysql2')
const HOST = 'localhost' // Change to actual host
const cors = require('cors')
const morgan = require('morgan')
const monitor = require('./monitor.json')
const fs = require('fs')
const PORT = 3200 || process.env.PORT
const DB_NAME = 'sistemabancos'
const DB_USER = 'root'  // Change to your DB user
const DB_PASSWORD = 'root' // Change to your DB password

app.use(express.json())
app.use(cors())
app.use(morgan('dev'))

// Create a connection to the mysql database
const connection = mysql.createConnection({
    host: HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
})

// Test database connection
connection.connect(error => {
    if (error) throw error
    console.log('Database connection running!')
})



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})