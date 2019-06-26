import recordWorker from './record-worker'
const URL = window.URL || window.webkitURL

const globalProxy = {
  headInstanceReady: false,
  proxyInstanceCount: 0,
  defaultConfig: {
    sampleRate: 48000, // 采样率(48000)，注意：设定的值必须为 48000 的约数
    bufferSize: 4096, // 缓存大小，用来缓存声音
    sampleBits: 16, // 采样比特率，8 或 16
    twoChannel: false // 双声道
  },
  stream: null,
  recorderProxy: null,
  proxyInstance: null
}
function throwError (message) {
  if (message.toString().includes('NotFoundError')) {
    alert('未找到可用的录音设备！')
    return
  }
  console.error(message)
}
class Recorder {
  constructor (config = {}) {
    this.config = Object.assign({}, globalProxy.defaultConfig, config)
    this.recording = false
    this.callback = null
    this.worker = null
    this.ready = false,
    this.createTime = new Date().getTime()
  }
}
Recorder.prototype = {
  start () {
    if (this.recording) return
    globalProxy.recorderProxy.onaudioprocess = this.holdBuffer.bind(this)
    this.recording = true
  },

  stop (success) {
    if (!this.recording) return
    this.callback = success
    this.recording = false
    globalProxy.recorderProxy.onaudioprocess = null
  },

  clear () {
    if (this.recording) {
      throwError('请先停止录音！')
      return
    }
    this.worker.postMessage({
      command: 'clear'
    })
  },

  destroy () {
    globalProxy.proxyInstanceCount--
    this.config = null
    this.worker && this.worker.terminate()
    this.worker = null
    this.ready = false
    if (globalProxy.proxyInstanceCount < 1) {
      globalProxy.headInstanceReady = false
      globalProxy.recorderProxy = null
      if (globalProxy.proxyInstance && globalProxy.proxyInstance.state !== 'closed') {
        globalProxy.proxyInstance.suspend()
        globalProxy.proxyInstance.close()
        globalProxy.proxyInstance = null
      }
      globalProxy.stream && globalProxy.stream.getTracks().forEach(track => track.stop())
      globalProxy.stream = null
    }
  },

  handleStream (stream) {
    globalProxy.stream = stream
    const channelNumber = this.config.twoChannel ? 2 : 1
    // 创建一个音频环境对象
    const ACProxy = window.AudioContext || window.webkitAudioContext
    if (!ACProxy) {
      throwError('浏览器不支持录音功能！')
      return
    }
    globalProxy.proxyInstance = new ACProxy()

    if (globalProxy.proxyInstance.createScriptProcessor) {
      globalProxy.recorderProxy = globalProxy.proxyInstance.createScriptProcessor(this.config.bufferSize, channelNumber, channelNumber)
    } else if (globalProxy.proxyInstance.createJavaScriptNode) {
      globalProxy.recorderProxy = globalProxy.proxyInstance.createJavaScriptNode(this.config.bufferSize, channelNumber, channelNumber)
    } else {
      throwError('浏览器不支持录音功能！')
    }

    // 将声音输入这个对像
    const audioInputSource = globalProxy.proxyInstance.createMediaStreamSource(globalProxy.stream)

    audioInputSource.connect(globalProxy.recorderProxy)
    globalProxy.recorderProxy.connect(audioInputSource.context.destination)

    this.ready = true

    globalProxy.headInstanceReady = true
  },

  init () {
    if (globalProxy.proxyInstanceCount && !globalProxy.headInstanceReady) {
      const waitHeadInstance = this
      requestAnimationFrame(function () {
        waitHeadInstance.init()
      })
      // console.info('wait head instance')
      return
    }
    globalProxy.proxyInstanceCount++

    // 加载并启动 record worker
    let workerString = recordWorker.toString()
    // 移除函数包裹
    workerString = workerString.substr(workerString.indexOf('{') + 1)
    workerString = workerString.substr(0, workerString.lastIndexOf('}'))
    const workerBlob = new Blob([workerString])
    const workerURL = URL.createObjectURL(workerBlob)
    this.worker = new Worker(workerURL)
    URL.revokeObjectURL(workerURL)

    const instance = this
    this.worker.onmessage = function (e) {
      instance.callback && instance.callback(e.data)
    }

    this.worker.postMessage({
      command: 'init',
      config: this.config
    })

    if (globalProxy.recorderProxy) {
      this.ready = true
    } else {
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {}
      }

      if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function (constraints) {
          const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia
          if (!getUserMedia) {
            return Promise.reject(new Error('该浏览器版本不支持媒体捕获！'))
          }
          return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject)
          })
        }
      }
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(this.handleStream.bind(this)).catch(throwError)
    }
  },

  exportWAV (success, type) {
    this.callback = success
    type = type || this.config.type || 'audio/wav'
    this.worker.postMessage({
      command: 'exportWAV',
      type
    })
  },

  getSource () {
    return new Promise((resolve) => {
      this.exportWAV(function (data) {
        resolve(data)
      }, 'audio/wav')
    })
  },

  holdBuffer (e) {
    if (this.recording) {
      const data = e.inputBuffer
      const buffer = !this.config.twoChannel ? [
        data.getChannelData(0)
      ] : [
          data.getChannelData(0),
          data.getChannelData(1)
        ]
      this.worker.postMessage({
        command: 'record',
        buffer
      })
    }
  }
}

export default Recorder
