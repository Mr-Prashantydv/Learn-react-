import React from 'react';
import ReactDOMClient from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

ReactDOMClient.createRoot(document.getElementById('root')).render(<App />);
