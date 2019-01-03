const config = {
  engineType: 'sms16k', // 引擎类型, 默认即可
  aue: 'raw', // 音频编码，本实例取'raw'
  sampleRate: 16000, // 采样率(48000)，注意：设定的值必须为 48000 的约数
  sampleBits: 16, // 采样比特率，8 或 16
  twoChannel: false // 双声道
}

export default config
