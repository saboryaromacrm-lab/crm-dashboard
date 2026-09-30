import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerModules } from './modules';
import { iniciarApp } from '@core/pwa/app.js';

// Global stylesheets. Order matters: reset -> design tokens -> base -> utilities.
import '@styles/reset.css';
import '@styles/tokens.css';
import '@styles/global.css';
import '@styles/utilities.css';

// Composition root: register every feature module BEFORE the router reads the
// registry to build routes and navigation. This is the app's bootstrap step.
registerModules();

// Instalable como app (ícono propio, ventana sin barra del navegador). Ver core/pwa/app.js.
iniciarApp();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
