import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { Provider } from 'react-redux'
import { store } from './store'
import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "ap-southeast-1_EwVHZAhsu",
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "6c99md6ibfavj6dukd1r6ehv6i",
    }
  }
})

if (import.meta.env.VITE_USE_DEFAULT_FONT === 'false') {
  document.body.classList.add('font-satoshi');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
