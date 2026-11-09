import ReactDOM from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles/themes.css'
import './styles/global.css'
import './styles/editor.css'
import './styles/settings.css'
import App from './App'
import appLogo from './assets/logo.png'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

if (window.api) {
  root.render(<App />)
} else {
  root.render(
    <div className="welcome">
      <img className="logo-mark" src={appLogo} alt="" aria-hidden="true" />
      <h1>Scriba</h1>
      <p>请通过 npm run dev 启动 Electron 窗口，当前页面缺少 preload API。</p>
      <p>Please launch the Electron window via npm run dev. The preload API is unavailable here.</p>
    </div>
  )
}
