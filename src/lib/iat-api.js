import request from '../api/request'
import {saltMd5} from '../utils/salt-md5'
import {Base64} from 'js-base64'
import readAsDataUrl from './readAsDataUrl'
import ASRConfig from './asr-config'
import Vue from 'vue'

const temp = new Vue()

const checkOptions = options => {
  temp.ASRConfig && Object.assign(ASRConfig, temp.ASRConfig)
  options.server && (ASRConfig.server = options.server)
  options.appId && (ASRConfig.appId = options.appId)
  options.APIKey && (ASRConfig.APIKey = options.APIKey)
}

export function IAT (audio, options) {
  options && checkOptions(options)
  let {engineType, aue} = ASRConfig
  let param = {
    engine_type: engineType,
    aue
  }
  let curTime = (new Date().getTime() / 1000) | 0 + ''
  param = Base64.encode(JSON.stringify(param))

  const upload = data => {
    // interface document: https://doc.xfyun.cn/rest_api/语音听写.html
    return request({
      url: ASRConfig.server + 'asr',
      method: 'post',
      data: 'audio=' + encodeURI(data.split(',')[1]),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-Appid': ASRConfig.appId,
        'X-CurTime': curTime,
        'X-Param': param,
        'X-CheckSum': saltMd5(ASRConfig.APIKey + curTime + param)
      }
    })
  }
  return readAsDataUrl(audio).then(data => {
    return upload(data)
  })
}
