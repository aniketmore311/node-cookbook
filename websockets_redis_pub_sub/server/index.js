//@ts-check
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const redis = require('redis')
const http = require('http')
const { WebSocketServer } = require('ws')

async function setupWebsocketsOverRedis(server, REDIS_URI) {
  const client = redis.createClient({
    url: REDIS_URI
  })
  const publisher = redis.createClient({
    url: REDIS_URI
  })
  await client.connect()
  await publisher.connect()
  const subscriber = client.duplicate()
  await subscriber.connect()

  console.info("connected to redis")

  const wss = new WebSocketServer({ server: server })

  // when a message is received from redis publish it to all connected clients
  subscriber.subscribe("new_message", (message) => {
    console.log("message received from redis")
    console.log(message)
    wss.clients.forEach(ws => {
      console.log('message sent to socket')
      console.log(message)
      ws.send(message)
    })
  })

  // when message is received from websocket publish it to redis
  wss.addListener("connection", (ws) => {
    console.log('new connection added')
    ws.addEventListener('message', (msg) => {
      console.log("message received from websocket")
      console.log(msg.data.toString())
      publisher.publish("new_message", msg.data.toString()).then((res) => {
        console.log("message sent to redis")
        console.log(msg.data.toString())
      })
    })
  })

}

async function main() {

  const NODE_ENV = process.env.NODE_ENV;
  const PORT = process.env.PORT
  const REDIS_URI = process.env.REDIS_URI


  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({
    extended: false
  }))
  app.use(cors())

  const server = http.createServer(app)

  await setupWebsocketsOverRedis(server, REDIS_URI)

  server.listen(PORT, () => {
    console.info(
      `server(mode: ${NODE_ENV}) started on: http://localhost:${PORT}`
    )
    console.debug(`pid: ${process.pid}`)
  })

  function onClose() {
    console.debug('graceful shutdown started')
    server.close(() => {
      console.debug('graceful shutdown complete')
      process.exit(1)
    })
  }

}

main().catch((err) => {
  console.log(err)
  process.exit(1)
})