import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@kuruwic/tokenized-search-input/styles';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
