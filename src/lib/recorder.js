import recordWorker from './record-worker'
const URL = window.URL || window.webkitURL

const Recorder = function (config = {}) {
  this.throwError = (config && config.error) || function (message) {
    if (message.toString().includes('NotFoundError')) {
      alert('未找到可用的录音设备！')
      return
    }
    alert(message)
  }

  const defaultConfig = {
    sampleRate: 48000, // 采样率(48000)，注意：设定的值必须为 48000 的约数
    bufferSize: 4096, // 缓存大小，用来缓存声音
    sampleBits: 16, // 采样比特率，8 或 16
    twoChannel: false // 双声道
  }

  config = Object.assign({}, defaultConfig, config)

  let channelNumber = config.twoChannel ? 2 : 1

  // 加载并启动 record worker
  let workerString = recordWorker.toString()
  // 移除函数包裹
  workerString = workerString.substr(workerString.indexOf('{') + 1)
  workerString = workerString.substr(0, workerString.lastIndexOf('}'))
  const workerBlob = new Blob([workerString])
  const workerURL = URL.createObjectURL(workerBlob)
  const worker = new Worker(workerURL)
  URL.revokeObjectURL(workerURL)

  worker.postMessage({
    command: 'init',
    config
  })

  this.recording = false
  let callback = null
  let audioBlob = null

  const play = player => {
    const src = URL.createObjectURL(audioBlob)
    if (!player) {
      player = document.createElement('audio')
      player.controls = 'controls'
      player.autoplay = 'autoplay'
      player.onended = () => {
        player = null
        URL.revokeObjectURL(src)
      }
    }
    player.src = src
  }

  const download = filename => {
    let url = URL.createObjectURL(audioBlob)
    let link = document.createElement('a')
    link.href = url
    link.download = filename || new Date().getTime() + '.wav'
    link.click()
    link = null
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 100)
  }

  this.init = () => {
    this.start = () => {
      if (this.recording) return
      // window.ACProxyInstance.state === 'suspended' && window.ACProxyInstance.resume()
      audioBlob = null
      this.recording = true
    }

    this.stop = success => {
      if (!this.recording) return
      // window.ACProxyInstance.state === 'running' && window.ACProxyInstance.suspend()
      callback = success
      this.recording = false
    }

    this.clear = () => {
      if (this.recording) {
        this.throwError('请先停止录音！')
        return
      }
      worker.postMessage({
        command: 'clear'
      })
    }

    this.getBuffer = success => {
      callback = success
      worker.postMessage({
        command: 'getBuffer'
      })
    }

    this.getSource = () => {
      return new Promise((resolve) => {
        if (audioBlob) {
          resolve(audioBlob)
        } else {
          this.exportWAV(data => {
            resolve(data)
          }, 'audio/wav')
        }
      })
    }

    this.download = filename => {
      if (!audioBlob) {
        this.exportWAV(data => {
          audioBlob = data
          download(filename)
        }, 'audio/wav')
        return
      }
      download(filename)
    }

    this.play = player => {
      if (!audioBlob) {
        this.exportWAV(data => {
          audioBlob = data
          play(player)
        }, 'audio/wav')
        return
      }
      play(player)
    }

    this.exportWAV = (success, type) => {
      if (audioBlob) {
        callback && callback(audioBlob)
        return
      }
      callback = success
      type = type || config.type || 'audio/wav'
      worker.postMessage({
        command: 'exportWAV',
        type
      })
    }

    // 音频采集
    const holdBuffer = e => {
      if (this.recording) {
        const buffer = !config.twoChannel ? [
          e.detail.getChannelData(0)
        ] : [
          e.detail.getChannelData(0),
          e.detail.getChannelData(1)
        ]
        worker.postMessage({
          command: 'record',
          buffer
        })
      }
    }
    document.addEventListener('audioprocess', holdBuffer)

    // 销毁录制对象
    this.destroy = () => {
      window.recorderProxy = null
      window.ACProxyInstance.state !== 'closed' &&
      window.ACProxyInstance.suspend() &&
      window.ACProxyInstance.close()
      document.removeEventListener('audioprocess', holdBuffer)
    }

    worker.onmessage = e => {
      callback && callback(e.data)
    }

    document.dispatchEvent(new Event('recorder-init'))
  }

  if (window.recorderProxy) {
    this.init()
  } else {
    const onsuccess = stream => {
      // 创建一个音频环境对象
      window.ACProxy = window.AudioContext || window.webkitAudioContext
      if (!window.ACProxy) {
        this.throwError('浏览器不支持录音功能！')
        return
      }
      window.ACProxyInstance = new window.ACProxy()

      if (window.ACProxyInstance.createScriptProcessor) {
        window.recorderProxy = window.ACProxyInstance.createScriptProcessor(config.bufferSize, channelNumber, channelNumber)
      } else if (window.ACProxyInstance.createJavaScriptNode) {
        window.recorderProxy = window.ACProxyInstance.createJavaScriptNode(config.bufferSize, channelNumber, channelNumber)
      } else {
        this.throwError('浏览器不支持录音功能！')
      }

      // 将声音输入这个对像
      const audioInputSource = window.ACProxyInstance.createMediaStreamSource(stream)

      audioInputSource.connect(window.recorderProxy)
      window.recorderProxy.connect(audioInputSource.context.destination)

      this.init()

      // 音频转发
      window.recorderProxy.onaudioprocess = e => {
        document.dispatchEvent(new CustomEvent('audioprocess', {detail: e.inputBuffer}))
      }

      setTimeout(() => {
        // Safari 浏览器不支持 suspend 和 resume 方法
        // window.ACProxyInstance.suspend()
      })
      window.isAudioAvailable = this.isAudioAvailable = true
    }

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
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
      .then(stream => {
        onsuccess(stream)
      })
      .catch(error => {
        this.throwError(error)
      })
  }
}

window.isAudioAvailable = Recorder.prototype.isAudioAvailable = false

export default Recorder
