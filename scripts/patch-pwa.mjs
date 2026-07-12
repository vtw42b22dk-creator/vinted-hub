import fs from 'node:fs'

var siteUrl = process.env.SITE_URL || ''
var manifestPath = 'out/manifest.webmanifest'

if (!fs.existsSync(manifestPath)) {
  console.log('manifest não encontrado — skip')
  process.exit(0)
}

var m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
m.start_url = siteUrl
m.scope = siteUrl
fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n')
console.log('PWA manifest →', siteUrl)
