/**
 * md5 加密操作
 */
import md5 from 'blueimp-md5'
// 假设取得了 salt 值
// salt 不一定会拿到前台
let salt = ''
export function saltMd5 (string) {
  return md5(string + salt)
}
