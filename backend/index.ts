import { createApp } from './app.js'
import { environment } from './config/environment.js'

createApp().listen(environment.apiPort, () => {
  console.log(
    `PostFlow API disponível em http://localhost:${environment.apiPort}`,
  )
})
