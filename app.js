const express = require('express')
const app = express()
const axios = require('axios')
const mysql = require('mysql2')
const HOST = 'localhost' // Change to actual host
const cors = require('cors')
const morgan = require('morgan')
const monitor = require('./monitor.json')
const fs = require('fs')
const PORT = 5000 || process.env.PORT
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

app.post('/switch', (req, res) => {
    const body = req.body
    const { service, enabled } = body
    monitor[service].enabled = enabled
    fs.writeFileSync('./monitor.json', JSON.stringify(monitor))
    res.send('Switched')
})

// consultar tarjeta
app.get('/tarjeta-:numero', (req, res) => {
    // get if consultas is enabled
    const enabled = monitor.consultas.enabled
    if (enabled) {
        const { numero } = req.params
        const query = `SELECT tarjeta.id, tarjeta.numero, tarjeta.fecha_expiracion, tarjeta.cvv, tarjeta.proveedor, tarjeta.credito, cuenta.nombre_titular FROM tarjeta INNER JOIN cuenta ON tarjeta.id_cuenta = cuenta.id WHERE tarjeta.numero = ${numero}`
        connection.query(query, (error, result) => {
            if (error) throw error
            if (result.length > 0) {
                res.json(result)
            } else {
                res.send('Empty result')
            }
        })
    } else {
        res.send('Consultas deshabilitadas')
    }
})

// consultar cuenta
app.get('/cuenta-:numero', (req, res) => {
    const enabled = monitor.consultas.enabled
    if (enabled) {
        const { numero } = req.params
        const query = `SELECT cuenta.id, cuenta.numero, cuenta.nombre_titular, cuenta.email, cuenta.saldo, banco.nombre FROM cuenta INNER JOIN banco ON cuenta.id_banco = banco.id WHERE cuenta.numero = ${numero}`
        connection.query(query, (error, result) => {
            if (error) throw error
            if (result.length > 0) {
                res.json(result)
            } else {
                res.send('Empty result')
            }
        })
    } else {
        res.send('Consultas deshabilitadas')
    }
})


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})