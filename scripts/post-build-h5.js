const fs = require('fs')
const path = require('path')

const h5Dir = path.resolve(__dirname, '../dist/build/h5')
const indexPath = path.join(h5Dir, 'index.html')

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf-8')
  
  content = content.replace(/\s+crossorigin(="[^"]*")?/g, '')
  
  fs.writeFileSync(indexPath, content, 'utf-8')
  console.log('✅ 已移除 index.html 中的 crossorigin 属性')
} else {
  console.log('❌ 未找到 index.html:', indexPath)
  process.exit(1)
}
