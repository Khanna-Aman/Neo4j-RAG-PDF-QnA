import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Analytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await fetch('/analytics');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setAnalytics(data);
        } catch (error) {
            console.error('Analytics error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const clearCache = async () => {
        try {
            const response = await fetch('/admin/clear-cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            alert('Cache cleared successfully');
            fetchAnalytics();
        } catch (error) {
            console.error('Cache clear error:', error);
            alert('Failed to clear cache');
        }
    };

    if (loading) {
        return (
            <div className="analytics-section">
                <div className="loading">Loading analytics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-section">
                <div className="error">Error loading analytics: {error}</div>
            </div>
        );
    }

    return (
        <div className="analytics-section">
            <h2>📊 System Analytics</h2>

            <div className="analytics-grid">
                <div className="analytics-card">
                    <h3>📄 Document Statistics</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <strong>Total Documents:</strong> {analytics.documents.totalDocs}
                        </div>
                        <div className="stat-item">
                            <strong>Average Size:</strong> {analytics.documents.avgSize?.toFixed(0)} chars
                        </div>
                        <div className="stat-item">
                            <strong>Total Chunks:</strong> {analytics.chunks.totalChunks}
                        </div>
                        <div className="stat-item">
                            <strong>Average Words per Chunk:</strong> {analytics.chunks.avgWordCount?.toFixed(0)}
                        </div>
                    </div>
                </div>

                <div className="analytics-card">
                    <h3>⚡ Performance Metrics</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <strong>Total Queries:</strong> {analytics.metrics.totalQueries}
                        </div>
                        <div className="stat-item">
                            <strong>Average Response Time:</strong> {analytics.metrics.averageResponseTime?.toFixed(2)}ms
                        </div>
                        <div className="stat-item">
                            <strong>Cache Hit Rate:</strong> {(analytics.metrics.cacheHitRate * 100).toFixed(1)}%
                        </div>
                        <div className="stat-item">
                            <strong>Error Rate:</strong> {(analytics.metrics.errorRate * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className="analytics-card">
                    <h3>💾 Cache Statistics</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <strong>Cache Keys:</strong> {analytics.cacheStats.keys}
                        </div>
                        <div className="stat-item">
                            <strong>Cache Hits:</strong> {analytics.cacheStats.hits}
                        </div>
                        <div className="stat-item">
                            <strong>Cache Misses:</strong> {analytics.cacheStats.misses}
                        </div>
                        <div className="stat-item">
                            <strong>Hit Ratio:</strong> {analytics.cacheStats.hits > 0 ?
                                ((analytics.cacheStats.hits / (analytics.cacheStats.hits + analytics.cacheStats.misses)) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                    <button onClick={clearCache} className="clear-cache-button">
                        Clear Cache
                    </button>
                </div>
            </div>

            <div className="charts-section">
                <div className="chart-container">
                    <h3>📈 Performance Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Response Time', value: analytics.metrics.averageResponseTime },
                            { name: 'Cache Hit Rate', value: analytics.metrics.cacheHitRate * 100 },
                            { name: 'Error Rate', value: analytics.metrics.errorRate * 100 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="system-info">
                <h3>🔧 System Information</h3>
                <div className="info-grid">
                    <div className="info-item">
                        <strong>Last Updated:</strong> {new Date(analytics.timestamp).toLocaleString()}
                    </div>
                    <div className="info-item">
                        <strong>Status:</strong> Operational
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
