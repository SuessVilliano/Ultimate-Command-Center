// Example mount for the LIV8 AR Studio SQR proxy.
// Keep SQR_API_KEY in server environment variables only.
import express from 'express'
import sqrRouter from './sqr.js'

const app = express()
app.use('/api/sqr', sqrRouter)

app.listen(process.env.PORT || 8787, () => {
  console.log('AR Studio API listening')
})
