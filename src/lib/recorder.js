import recordWorker from './record-worker'
const URL = window.URL || window.webkitURL
let recorderInstance = null
function Recorder () {
  this.config = null
  this.recording = false
  this.callback = null
  this.worker = null
}
Recorder.prototype = {
  ready: function () {
    this.proxyInstanceCount++
    document.dispatchEvent(new Event('recorder-init'))
  },
  start: function () {
    if (this.recording) return
    this.recording = true
  },
  stop: function (success) {
    if (!this.recording) return
    this.callback = success
    this.recording = false
  },
  clear: function () {
    if (this.recording) {
      this.throwError('请先停止录音！')
      return
    }
    this.worker.postMessage({
      command: 'clear'
    })
  },
  destroy: function () {
    this.proxyInstanceCount--
    if (!this.proxyInstanceCount) {
      this.recorderProxy = null
      this.proxyInstance &&
        this.proxyInstance.state !== 'closed' &&
        this.proxyInstance.suspend() &&
        this.proxyInstance.close()
      this.proxyInstance = null
      this.stream && this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
      window.isAudioAvailable = this.isAudioAvailable = false
      recorderInstance = null
    }
  },
  handleStream: function (stream) {
    this.stream = stream
    const channelNumber = this.config.twoChannel ? 2 : 1
    // 创建一个音频环境对象
    const ACProxy = window.AudioContext || window.webkitAudioContext
    if (!ACProxy) {
      this.throwError('浏览器不支持录音功能！')
      return
    }
    this.proxyInstance = new ACProxy()

    if (this.proxyInstance.createScriptProcessor) {
      this.recorderProxy = this.proxyInstance.createScriptProcessor(this.config.bufferSize, channelNumber, channelNumber)
    } else if (recorder.proxyInstance.createJavaScriptNode) {
      this.recorderProxy = this.proxyInstance.createJavaScriptNode(this.config.bufferSize, channelNumber, channelNumber)
    } else {
      this.throwError('浏览器不支持录音功能！')
    }

    // 将声音输入这个对像
    const audioInputSource = this.proxyInstance.createMediaStreamSource(this.stream)

    audioInputSource.connect(this.recorderProxy)
    this.recorderProxy.connect(audioInputSource.context.destination)

    this.ready()

    this.recorderProxy.onaudioprocess = this.holdBuffer.bind(this)

    window.isAudioAvailable = this.isAudioAvailable = true
  },
  init: function (config = {}) {
    this.config = Object.assign({}, this.defaultConfig, config)

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

    if (this.recorderProxy) {
      this.ready()
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
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(this.handleStream.bind(this)).catch(this.throwError)
    }
  },
  defaultConfig: {
    sampleRate: 48000, // 采样率(48000)，注意：设定的值必须为 48000 的约数
    bufferSize: 4096, // 缓存大小，用来缓存声音
    sampleBits: 16, // 采样比特率，8 或 16
    twoChannel: false // 双声道
  },
  proxyInstanceCount: 0,
  stream: null,
  recorderProxy: null,
  proxyInstance: null,
  holdBuffer: function (e) {
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
  },
  exportWAV: function (success, type) {
    this.callback = success
    type = type || this.config.type || 'audio/wav'
    this.worker.postMessage({
      command: 'exportWAV',
      type
    })
  },
  getSource: function () {
    return new Promise((resolve) => {
      this.exportWAV(function (data) {
        resolve(data)
      }, 'audio/wav')
    })
  },
  throwError: (this.config && this.config.error) || function (message) {
    if (message.toString().includes('NotFoundError')) {
      alert('未找到可用的录音设备！')
      return
    }
    console.error(message)
  },
  isAudioAvailable: false
}

recorderInstance = new Recorder()

export default recorderInstance
