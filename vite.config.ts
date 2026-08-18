import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-file-db-middleware',
      configureServer(server) {
        server.middlewares.use('/api/db', (req, res) => {
          const dbPath = path.join(process.cwd(), 'database', 'db.json')
          const dbDir = path.dirname(dbPath)

          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true })
          }

          if (req.method === 'GET') {
            if (fs.existsSync(dbPath)) {
              try {
                const data = fs.readFileSync(dbPath, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(data)
                return
              } catch (err) {
                console.error('Error reading db.json:', err)
              }
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({}))
          } else if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => {
              try {
                fs.writeFileSync(dbPath, body, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true }))
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }))
              }
            })
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

