// 思源资源相对于服务根目录，不能相对于导图 iframe 所在的插件目录。
export const resolveSiyuanImageUrl = imageURL => {
  if (!/^(?:\.\/|\/)?assets\//.test(imageURL)) return imageURL

  const assetPath = '/' + imageURL.replace(/^(?:\.\/|\/)/, '')
  return typeof window === 'undefined'
    ? assetPath
    : new URL(assetPath, window.location.href).href
}

const blobToDataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

const getImageSize = src => new Promise(resolve => {
  const img = new Image()
  img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
  img.onerror = () => resolve({ width: 100, height: 100 })
  img.src = src
})

// 在传入 iframe 前嵌入图片，避免资源相对路径和跨域请求影响显示、导出。
export const processSiyuanImages = async node => {
  const promises = []
  const walk = current => {
    if (current.data?.image && !current.data.image.startsWith('data:')) {
      promises.push((async () => {
        // 下载失败时也保留正确地址，供导图渲染器直接加载或重试。
        current.data.image = resolveSiyuanImageUrl(current.data.image)
        try {
          const response = await fetch(current.data.image, {
            cache: 'default',
            credentials: 'same-origin'
          })
          if (!response.ok) return
          const base64 = await blobToDataURL(await response.blob())
          current.data.image = base64
          current.data.imageSize = await getImageSize(base64)
        } catch (error) {
          console.error('Failed to fetch Siyuan image:', error)
        }
      })())
    }
    current.children?.forEach(walk)
  }
  walk(node)
  await Promise.all(promises)
}
