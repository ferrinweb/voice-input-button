/**
 * ArrayBuffer Convert To Base64 String
 * @param buffer
 * @return {string}
 */
function arrayBufferToBase64 (buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let len = bytes.byteLength, i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export default arrayBufferToBase64
