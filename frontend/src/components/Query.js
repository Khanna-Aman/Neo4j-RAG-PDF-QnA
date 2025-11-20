import React, { useState } from 'react';
import { useAppContext } from '../AppContext';

const Query = () => {
    const [question, setQuestion] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [maxResults, setMaxResults] = useState(5);

    const { isQuerying, setIsQuerying } = useAppContext();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!question.trim()) return;

        setLoading(true);
        setIsQuerying(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question,
                    includeMetadata,
                    maxResults
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setResult(data);

        } catch (error) {
            console.error('Query error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
            setIsQuerying(false);
        }
    };

    return (
        <div className="query-section">
            <h2>🔍 Query Your Documents</h2>

            <form onSubmit={handleSubmit} className="query-form">
                <div className="query-input-group">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask a question about your uploaded documents..."
                        className="query-input"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !question.trim()}
                        className="query-button"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>

                <div className="query-options">
                    <label className="option-label">
                        <input
                            type="checkbox"
                            checked={includeMetadata}
                            onChange={(e) => setIncludeMetadata(e.target.checked)}
                            disabled={loading}
                        />
                        Include metadata
                    </label>

                    <label className="option-label">
                        Max results:
                        <select
                            value={maxResults}
                            onChange={(e) => setMaxResults(Number(e.target.value))}
                            disabled={loading}
                            className="results-select"
                        >
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                        </select>
                    </label>
                </div>
            </form>

            {error && (
                <div className="error">
                    Error: {error}
                </div>
            )}

            {loading && (
                <div className="loading">
                    Processing your query with AI...
                </div>
            )}

            {result && (
                <div className="query-results">
                    <div className="result-header">
                        <h3>🤖 AI Answer</h3>
                        <div className="result-metadata">
                            <span>Response Time: {result.responseTime}ms</span>
                            {result.cached && <span className="cached-indicator">📄 Cached</span>}
                            <span>Method: {result.retrievalMethod}</span>
                        </div>
                    </div>

                    <div className="answer-section">
                        <p>{result.answer}</p>
                    </div>

                    {result.queryVariations && result.queryVariations.length > 1 && (
                        <div className="query-variations">
                            <h4>🔄 Query Variations Used</h4>
                            <ul>
                                {result.queryVariations.map((variation, index) => (
                                    <li key={index}>{variation}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.sources && result.sources.length > 0 && (
                        <div className="sources-section">
                            <h4>📚 Relevant Sources</h4>
                            {result.sources.map((source, index) => (
                                <div key={index} className="source-item">
                                    <div className="source-scores">
                                        <span className="score hybrid">Hybrid: {(source.hybridScore * 100).toFixed(1)}%</span>
                                        <span className="score vector">Vector: {(source.vectorScore * 100).toFixed(1)}%</span>
                                        <span className="score bm25">BM25: {source.bm25Score.toFixed(2)}</span>
                                    </div>
                                    <div className="source-content">
                                        {source.content}
                                    </div>
                                    <div className="source-metadata">
                                        Document: {source.docId} | Chunk: {source.chunkIndex}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Query;
