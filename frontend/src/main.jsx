import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          background: '#0c0a09',
          color: '#ef4444',
          fontFamily: 'monospace',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <h1 style={{ fontSize: '22px', marginBottom: '12px', color: '#f87171', letterSpacing: '0.05em' }}>
            OPS! OCORREU UM ERRO DE RENDERIZAÇÃO
          </h1>
          <p style={{ fontSize: '13px', color: '#d6d3d1', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
            Isso geralmente ocorre devido a dados antigos ou inconsistências no cache do navegador (LocalStorage).
          </p>
          
          <pre style={{
            background: '#1c1917',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'left',
            maxWidth: '800px',
            width: '90%',
            overflowX: 'auto',
            border: '1px solid #44403c',
            color: '#fca5a5',
            fontSize: '11px',
            lineHeight: '1.5',
            boxSizing: 'border-box',
            marginBottom: '28px'
          }}>
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.error && this.state.error.stack}
          </pre>
          
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '12px 28px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '11px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
          >
            Limpar Cache Local e Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
