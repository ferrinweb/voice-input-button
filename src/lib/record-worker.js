/**
 * Recorder EncodeWAV Worker
 * Note: only the recordWorker function's body codes will be loaded as worker.
 * 注意：仅该函数内部代码会被引入到 worker
 */
const recordWorker = function () {
  let recLength = 0
  let recBuffersL = []
  let recBuffersR = []
  let sampleRate
  let sampleBits
  let twoChannel

  // 指令集和
  const workerInterface = {
    // 初始化
    init: function (message) {
      const config = message.config
      sampleRate = config.sampleRate
      sampleBits = config.sampleBits
      twoChannel = config.twoChannel
    },
    // 录制
    record: function record (message) {
      const buffer = message.buffer
      recBuffersL.push(buffer[0])
      twoChannel && recBuffersR.push(buffer[1])
      recLength += buffer[0].length
    },
    // 导出
    exportWAV: function (message) {
      let interleaved = null
      if (!twoChannel) {
        const bufferL = mergeBuffers(recBuffersL, recLength)
        interleaved = interleave(bufferL)
      } else {
        const bufferL = mergeBuffers(recBuffersL, recLength)
        const bufferR = mergeBuffers(recBuffersR, recLength)
        interleaved = interleave(bufferL, bufferR)
      }
      const dataView = encodeWAV(interleaved)
      const audioBlob = new Blob([dataView], {type: message.type})

      postMessage(audioBlob)
    },
    // 获取 buffer 数据
    getBuffer: function () {
      const buffers = []
      buffers.push(mergeBuffers(recBuffersL, recLength))
      buffers.push(mergeBuffers(recBuffersR, recLength))
      postMessage(buffers)
    },
    // 清理，重置
    clear: function () {
      recLength = 0
      recBuffersL = []
      recBuffersR = []
    }
  }

  function mergeBuffers (recBuffers, recLength) {
    const result = new Float32Array(recLength)
    let offset = 0
    for (let i = 0; i < recBuffers.length; i++) {
      result.set(recBuffers[i], offset)
      offset += recBuffers[i].length
    }
    return result
  }

  // 交错
  function interleave (inputL, inputR) {
    let compression = 48000 / sampleRate // 压缩倍率
    let length = !twoChannel ? inputL.length : (inputL.length + inputR.length)
    length /= compression
    const result = new Float32Array(length)

    let index = 0
    let inputIndex = 0

    while (index < length) {
      result[index++] = inputL[inputIndex]
      twoChannel && (result[index++] = inputR[inputIndex])
      // 根据比特率进行压缩
      inputIndex += compression
    }
    return result
  }

  function floatTo16BitPCM (output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]))
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }
  }

  function floatTo8BitPCM (output, offset, input) {
    for (let i = 0; i < input.length; i++, offset++) {
      let s = Math.max(-1, Math.min(1, input[i]))
      let val = s < 0 ? s * 0x8000 : s * 0x7FFF
      val = parseInt(255 / (65535 / (val + 32768)))
      output.setInt8(offset, val, true)
    }
  }

  function writeString (view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  function encodeWAV (samples) {
    let dataLength = samples.length * (sampleBits / 8)
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    /* RIFF identifier */
    writeString(view, 0, 'RIFF')
    /* file length */
    view.setUint32(4, 36 + dataLength, true)
    /* RIFF type */
    writeString(view, 8, 'WAVE')
    /* format chunk identifier */
    writeString(view, 12, 'fmt ')
    /* format chunk length */
    view.setUint32(16, 16, true)
    /* sample format (raw) */
    view.setUint16(20, 1, true)
    /* channel count */
    view.setUint16(22, !twoChannel ? 1 : 2, true)
    /* sample rate */
    view.setUint32(24, sampleRate, true)
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * (twoChannel ? 2 : 1) * sampleBits / 8, true)
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, (twoChannel ? 2 : 1) * sampleBits / 8, true)
    /* bits per sample */
    view.setUint16(34, sampleBits, true)
    /* data chunk identifier */
    writeString(view, 36, 'data')
    /* data chunk length */
    view.setUint32(40, dataLength, true)

    sampleBits === 16 ? floatTo16BitPCM(view, 44, samples) : floatTo8BitPCM(view, 44, samples)

    return view
  }

  onmessage = function (e) {
    const data = e.data
    workerInterface[data.command](data)
  }
}

export default recordWorker
