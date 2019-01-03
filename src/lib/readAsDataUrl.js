/**
 * Convert Blob To DataUrl
 * @param blob {Blob|File}
 * @return {Promise<any>}
 */
const readAsDataUrl = function (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      resolve(e.target.result)
    }
    reader.onerror = function (e) {
      reject(e)
    }
    reader.readAsDataURL(blob)
  })
}

export default readAsDataUrl
