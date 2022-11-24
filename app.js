const express = require('express')
const app = express()
const credentials = require('../db_credentials');
const axios = require('axios')
const mysql = require('mysql2')
const HOST = 'localhost' // Change to actual host
const cors = require('cors')
const morgan = require('morgan')
const monitor = require('./monitor.json')
const fs = require('fs')
var setTerminalTitle = require('set-terminal-title');
setTerminalTitle('API Bank', { verbose: true });
const PORT = 5000 || process.env.PORT
const DB_NAME = 'sistemabancos'
const DB_USER = credentials['DB_USER']
const DB_PASSWORD = credentials['DB_PASSWORD']

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

// transaccion de tarjeta a cuenta
app.post('/transaccion-tarjeta', (req, res) => {
    const enabled = monitor.transacciones.enabled
    if (enabled) {
        const body = req.body
        const { paymentMethod, numero_cuenta, monto } = body
        let id_origen
        let id_destino

        console.log(paymentMethod)

        const date = new Date()
        const fecha = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
        const hora = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`

        let query = `SELECT * FROM tarjeta WHERE numero = ${paymentMethod.numero} AND cvv = ${paymentMethod.codigo} AND fecha_expiracion = '${paymentMethod.fecha}' AND proveedor = '${paymentMethod.proveedor}'`
        connection.query(query, (error, result) => {
            console.log(query)
            console.log(result)
            if (error) throw error
            if (result.length > 0) {
                const tarjeta = result[0]
                id_origen = tarjeta.id
                query = `INSERT INTO transaccion (fecha, hora, tipo, monto, id_tarjeta, completado) VALUES ('${fecha}', '${hora}', '${0}', ${monto}, ${tarjeta.id}, ${false})`
                connection.query(query, (error, result) => {
                    if (error) throw error
                    query = `SELECT * FROM cuenta WHERE numero = ${numero_cuenta}`
                    connection.query(query, (error, result) => {
                        if (error) throw error
                        if (result.length > 0) {
                            const cuenta = result[0]
                            id_destino = cuenta.id
                            query = `INSERT INTO transaccion (fecha, hora, tipo, monto, id_cuenta, completado) VALUES ('${fecha}', '${hora}', '${1}', ${monto}, ${cuenta.id}, ${false})`
                            connection.query(query, (error, result) => {
                                if (error) throw error
                                if (tarjeta.credito >= monto) {
                                    query = `UPDATE tarjeta SET credito = ${tarjeta.credito - monto} WHERE id = ${tarjeta.id}`
                                    connection.query(query, (error, result) => {
                                        if (error) throw error
                                        query = `UPDATE cuenta SET saldo = ${cuenta.saldo + monto} WHERE id = ${cuenta.id}`
                                        connection.query(query, (error, result) => {
                                            if (error) throw error
                                            // set completado to true
                                            query = `UPDATE transaccion SET completado = ${true} WHERE id_tarjeta = ${id_origen}`
                                            connection.query(query, (error, result) => {
                                                if (error) throw error
                                                query = `UPDATE transaccion SET completado = ${true} WHERE id_cuenta = ${id_destino}`
                                                connection.query(query, (error, result) => {
                                                    if (error) throw error
                                                    res.send('Transaccion exitosa')
                                                })
                                            })
                                        })
                                    })
                                } else {
                                    res.send('Credito insuficiente')
                                }
                            })
                        } else {
                            res.send('Cuenta no existe')
                        }
                    })
                })
            } else {
                res.send('Tarjeta no existe')
            }
        })
    } else {
        res.send('Transacciones deshabilitadas')
    }
})

// transaccion de cuenta a cuenta
app.post('/transaccion-cuenta', (req, res) => {
    const enabled = monitor.transacciones.enabled
    if (enabled) {
        const body = req.body
        const { paymentMethod, numero_cuenta_destino, monto } = body
        let id_origen
        let id_destino

        console.log(paymentMethod)

        const date = new Date()
        const fecha = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
        const hora = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`

        // verificar que la cuenta origen exista y tenga saldo
        let query = `SELECT * FROM cuenta INNER JOIN banco ON id_banco = banco.id WHERE numero = ${paymentMethod.numero} AND nombre_titular = '${paymentMethod.nombre}' AND email = '${paymentMethod.email}' AND banco.nombre = '${paymentMethod.banco}'`
        connection.query(query, (error, result) => {
            if (error) throw error
            console.log(result)
            if (result.length > 0) {
                const cuenta_origen = result[0]
                id_origen = cuenta_origen.id
                query = `INSERT INTO transaccion (fecha, hora, tipo, monto, id_cuenta, completado) VALUES ('${fecha}', '${hora}', '${0}', ${monto}, ${cuenta_origen.id}, ${false})`
                connection.query(query, (error, result) => {
                    if (error) throw error
                    query = `SELECT * FROM cuenta WHERE numero = ${numero_cuenta_destino}`
                    connection.query(query, (error, result) => {
                        if (error) throw error
                        if (result.length > 0) {
                            const cuenta_destino = result[0]
                            id_destino = cuenta_destino.id
                            query = `INSERT INTO transaccion (fecha, hora, tipo, monto, id_cuenta, completado) VALUES ('${fecha}', '${hora}', '${1}', ${monto}, ${cuenta_destino.id}, ${false})`
                            connection.query(query, (error, result) => {
                                if (error) throw error
                                if (cuenta_origen.saldo >= monto) {
                                    query = `UPDATE cuenta SET saldo = ${cuenta_origen.saldo - monto} WHERE id = ${cuenta_origen.id}`
                                    connection.query(query, (error, result) => {
                                        if (error) throw error
                                        query = `UPDATE cuenta SET saldo = ${cuenta_destino.saldo + monto} WHERE id = ${cuenta_destino.id}`
                                        connection.query(query, (error, result) => {
                                            if (error) throw error
                                            // set completado to true
                                            query = `UPDATE transaccion SET completado = ${true} WHERE id_cuenta = ${id_origen}`
                                            connection.query(query, (error, result) => {
                                                if (error) throw error
                                                query = `UPDATE transaccion SET completado = ${true} WHERE id_cuenta = ${id_destino}`
                                                connection.query(query, (error, result) => {
                                                    if (error) throw error
                                                    res.send('Transaccion exitosa')
                                                })
                                            })
                                        })
                                    })
                                } else {
                                    res.send('Saldo insuficiente')
                                }
                            })
                        } else {
                            res.send('Cuenta destino no existe')
                        }
                    })
                })
            } else {
                res.send('Cuenta origen no existe')
            }
        })
    } else {
        res.send('Transacciones deshabilitadas')
    }
})



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})