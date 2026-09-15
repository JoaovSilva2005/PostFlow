import { createApp } from './app'
import { environment } from './config/environment'

createApp().listen(environment.apiPort, () => {
  console.log(
    `PostFlow API disponível em http://localhost:${environment.apiPort}`,
  )
})
