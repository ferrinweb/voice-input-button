/**
 * A proxy server based on Node.js
 * edit by ferrinweb
 *
 * execute the 'node proxy' command to start the service.
 * default port: 3000
 */
let proxy = require('http-proxy-middleware')
let express = require('express')
let app = express()

let port = 3000

// Cross-domain settings
app.all('*', function (req, res, next) {
  if (!req.get('Origin')) return next()
  // use "*" here to accept any origin
  res.set('Access-Control-Allow-Origin', '*')
  // request methods allowed (get/post/patch...)
  res.set('Access-Control-Allow-Methods', '*')
  // field name allowed in request headers
  res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, token, X-Appid, X-CurTime, X-CheckSum, X-Param')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use('/asr', proxy({
  // Forward the request to the iFLYTEK speech interface
  target: 'http://api.xfyun.cn/v1/service/v1/iat',
  changeOrigin: true,
  pathRewrite: {
    '^/asr': ''
  }
}))

app.listen(port, function () {
  console.log(`Proxy is selling tickets, please buy a ticket at the ${port} port, and immediately cross the river!`)
})
