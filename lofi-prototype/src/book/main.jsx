import { createRoot } from 'react-dom/client'
import '../styles.css'
import './book.css'
import './mobile.css'
import Book from './Book'

// Tells the prototype it is being printed (e.g. toasts must not auto-dismiss).
window.__BOOK__ = true

createRoot(document.getElementById('root')).render(<Book />)
