import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Upload from './components/Upload';
import Query from './components/Query';
import Analytics from './components/Analytics';
import './App.css';

const App = () => {
    const [healthStatus, setHealthStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkHealth = async () => {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            setHealthStatus(data);
        } catch (error) {
            console.error('Health check failed:', error);
            setHealthStatus({ status: 'ERROR', error: 'Failed to connect to backend' });
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Connected':
                return 'status-connected';
            case 'Disconnected':
                return 'status-disconnected';
            default:
                return 'status-unknown';
        }
    };

    if (loading) {
        return (
            <div className="container">
                <div className="loading">Loading application...</div>
            </div>
        );
    }

    return (
        <Router>
            <div className="container">
                <header className="app-header">
                    <h1>PDF RAG Application - Phase 5</h1>
                    <p>Production-ready RAG with hybrid retrieval, query transformation, and monitoring</p>

                    <nav className="navigation">
                        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            Upload & Query
                        </NavLink>
                        <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            Analytics
                        </NavLink>
                    </nav>
                </header>

                <div className="health-status">
                    <h3>System Status</h3>
                    <div className="status-grid">
                        <div className={`status-item ${healthStatus?.status === 'OK' ? 'status-connected' : 'status-disconnected'}`}>
                            Backend: {healthStatus?.status || 'Unknown'}
                        </div>
                        <div className={`status-item ${getStatusClass(healthStatus?.neo4j)}`}>
                            Neo4j: {healthStatus?.neo4j || 'Unknown'}
                        </div>
                        <div className={`status-item ${getStatusClass(healthStatus?.geminiEmbedding)}`}>
                            Gemini Embedding: {healthStatus?.geminiEmbedding || 'Unknown'}
                        </div>
                        <div className={`status-item ${getStatusClass(healthStatus?.geminiGeneration)}`}>
                            Gemini Generation: {healthStatus?.geminiGeneration || 'Unknown'}
                        </div>
                        {healthStatus?.cache && (
                            <div className="status-item status-info">
                                Cache: {healthStatus.cache.keys} items
                            </div>
                        )}
                    </div>

                    {healthStatus?.metrics && (
                        <div className="metrics-summary">
                            <h4>Performance Metrics</h4>
                            <div className="metrics-grid">
                                <div className="metric-item">
                                    <strong>Total Queries:</strong> {healthStatus.metrics.totalQueries}
                                </div>
                                <div className="metric-item">
                                    <strong>Avg Response Time:</strong> {healthStatus.metrics.averageResponseTime?.toFixed(2)}ms
                                </div>
                                <div className="metric-item">
                                    <strong>Cache Hit Rate:</strong> {(healthStatus.metrics.cacheHitRate * 100).toFixed(1)}%
                                </div>
                                <div className="metric-item">
                                    <strong>Error Rate:</strong> {(healthStatus.metrics.errorRate * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    )}

                    {healthStatus?.error && (
                        <div className="error">
                            Error: {healthStatus.error}
                        </div>
                    )}
                </div>

                <Routes>
                    <Route path="/" element={
                        <div>
                            <Upload />
                            <Query />
                        </div>
                    } />
                    <Route path="/analytics" element={<Analytics />} />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
