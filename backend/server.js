import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import winston from 'winston';
import Joi from 'joi';
import natural from 'natural';
import compromise from 'compromise';
import pkg from 'ml-distance';
const { cosine } = pkg;

import { GoogleGenerativeAI } from '@google/generative-ai';
import driver from './neo4j.js';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Google Generative AI setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generationModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Validation schemas
const querySchema = Joi.object({
    question: Joi.string().min(3).max(500).required(),
    includeMetadata: Joi.boolean().default(false),
    maxResults: Joi.number().integer().min(1).max(20).default(5)
});

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Helper function to chunk text
function chunkText(text, chunkSize = 1000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

// Enhanced cosine similarity with validation
function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
        return 0;
    }

    try {
        return 1 - cosine(vec1, vec2);
    } catch (error) {
        // Fallback to manual calculation
        const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }

        return dotProduct / (magnitude1 * magnitude2);
    }
}

// BM25 scoring function
function calculateBM25Score(query, document, corpus) {
    const tokenizer = new natural.WordTokenizer();
    const queryTokens = tokenizer.tokenize(query.toLowerCase());
    const docTokens = tokenizer.tokenize(document.toLowerCase());

    const k1 = 1.2;
    const b = 0.75;
    const avgDocLength = corpus.reduce((sum, doc) => sum + doc.length, 0) / corpus.length;

    let score = 0;

    queryTokens.forEach(term => {
        const termFreq = docTokens.filter(token => token === term).length;
        const docFreq = corpus.filter(doc => doc.toLowerCase().includes(term)).length;

        if (docFreq > 0) {
            const idf = Math.log((corpus.length - docFreq + 0.5) / (docFreq + 0.5));
            const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docTokens.length / avgDocLength)));
            score += idf * tf;
        }
    });

    return score;
}

// JavaScript-native evaluation functions
class RAGEvaluator {
    constructor() {
        this.tfidf = new natural.TfIdf();
    }

    // Calculate semantic similarity using compromise.js
    calculateSemanticSimilarity(text1, text2) {
        const doc1 = compromise(text1);
        const doc2 = compromise(text2);

        const terms1 = new Set(doc1.terms().out('array'));
        const terms2 = new Set(doc2.terms().out('array'));

        const intersection = new Set([...terms1].filter(term => terms2.has(term)));
        const union = new Set([...terms1, ...terms2]);

        return intersection.size / union.size; // Jaccard similarity
    }

    // Calculate answer relevance
    calculateAnswerRelevance(question, answer) {
        return this.calculateSemanticSimilarity(question, answer);
    }

    // Calculate context precision
    calculateContextPrecision(retrievedChunks, relevantChunks) {
        if (retrievedChunks.length === 0) return 0;

        let relevant = 0;
        retrievedChunks.forEach(chunk => {
            if (relevantChunks.some(rel =>
                this.calculateSemanticSimilarity(chunk.content, rel.content) > 0.5
            )) {
                relevant++;
            }
        });

        return relevant / retrievedChunks.length;
    }

    // Calculate faithfulness
    calculateFaithfulness(answer, context) {
        const answerSentences = natural.SentenceTokenizer.tokenize(answer);
        if (answerSentences.length === 0) return 1;

        let faithfulSentences = 0;
        answerSentences.forEach(sentence => {
            if (this.calculateSemanticSimilarity(sentence, context) > 0.3) {
                faithfulSentences++;
            }
        });

        return faithfulSentences / answerSentences.length;
    }

    // Comprehensive evaluation
    async evaluateRAGResponse(question, answer, retrievedChunks, relevantChunks = []) {
        const context = retrievedChunks.map(chunk => chunk.content).join('\n');

        return {
            answerRelevance: this.calculateAnswerRelevance(question, answer),
            contextPrecision: this.calculateContextPrecision(retrievedChunks, relevantChunks),
            faithfulness: this.calculateFaithfulness(answer, context),
            timestamp: new Date().toISOString()
        };
    }
}

// Query transformation functions
async function generateMultipleQueries(originalQuery, numQueries = 3) {
    const prompt = `Generate ${numQueries} different ways to ask the following question. Each query should capture different aspects or perspectives of the original question:

Original Question: "${originalQuery}"

Please provide ${numQueries} alternative queries, each on a new line:`;

    try {
        const response = await generationModel.generateContent(prompt);
        const generatedText = response.response.text();
        const queries = generatedText.split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .slice(0, numQueries);

        return [originalQuery, ...queries];
    } catch (error) {
        logger.error('Error generating multiple queries:', error);
        return [originalQuery];
    }
}

// Performance monitoring
class RAGMetrics {
    constructor() {
        this.metrics = {
            totalQueries: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            errorRate: 0,
            averageRetrievalAccuracy: 0
        };
    }

    recordQuery(responseTime, cacheHit, error = false) {
        this.metrics.totalQueries++;
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) / this.metrics.totalQueries;

        if (cacheHit) {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1) + 1) / this.metrics.totalQueries;
        } else {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
        }

        if (error) {
            this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalQueries - 1) + 1) / this.metrics.totalQueries;
        } else {
            this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
        }
    }

    getMetrics() {
        return this.metrics;
    }
}

const ragMetrics = new RAGMetrics();
const ragEvaluator = new RAGEvaluator();

// Enhanced health check endpoint
app.get('/health', async (_req, res) => {
    const session = driver.session();
    let neo4jStatus = 'Connected';
    let embeddingStatus = 'Connected';
    let generationStatus = 'Connected';
    let overallStatus = 'OK';
    let errorMessage = null;

    try {
        logger.info('Performing health check');

        // Test Neo4j connection
        const result = await session.run('RETURN 1');
        logger.info('Neo4j connection successful');

        // Test embedding model
        try {
            await embeddingModel.embedContent('Health check test');
            logger.info('Embedding model test successful');
        } catch (error) {
            logger.error('Embedding model test failed:', error);
            embeddingStatus = 'Disconnected';
            overallStatus = 'ERROR';
            errorMessage = error.message;
        }

        // Test generation model
        try {
            await generationModel.generateContent('Health check test');
            logger.info('Generation model test successful');
        } catch (error) {
            logger.error('Generation model test failed:', error);
            generationStatus = 'Disconnected';
            overallStatus = 'ERROR';
            errorMessage = error.message || errorMessage;
        }

        res.json({
            status: overallStatus,
            neo4j: neo4jStatus,
            geminiEmbedding: embeddingStatus,
            geminiGeneration: generationStatus,
            cache: cache.getStats(),
            metrics: ragMetrics.getMetrics(),
            ...(errorMessage && { error: errorMessage }),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error('Health check failed:', err);
        neo4jStatus = 'Disconnected';
        res.json({
            status: 'ERROR',
            neo4j: neo4jStatus,
            geminiEmbedding: 'Unknown',
            geminiGeneration: 'Unknown',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        await session.close();
    }
});

// Enhanced PDF upload endpoint
app.post('/upload', upload.single('pdf'), async (req, res) => {
    const startTime = Date.now();

    try {
        logger.info('Processing PDF upload');

        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        // Read and process PDF
        const pdfBuffer = fs.readFileSync(req.file.path);
        const pdfUint8Array = new Uint8Array(pdfBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
        const pdfDocument = await loadingTask.promise;
        let text = '';

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        logger.info('PDF text extracted successfully');

        // Generate unique document ID
        const docId = `doc_${Date.now()}`;
        const chunks = chunkText(text, 1000);

        logger.info(`Created ${chunks.length} chunks from PDF`);

        const session = driver.session();

        try {
            // Create document node
            await session.run(
                'CREATE (d:Document {id: $id, title: $title, content: $content, uploadedAt: datetime(), processingTime: $processingTime})',
                {
                    id: docId,
                    title: req.file.originalname,
                    content: text,
                    processingTime: Date.now() - startTime
                }
            );

            // Process chunks with both vector embeddings and BM25 preparation
            const allChunks = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                try {
                    logger.info(`Processing chunk ${i + 1}/${chunks.length}`);

                    // Generate embedding
                    const result = await embeddingModel.embedContent(chunk);
                    const embedding = result.embedding.values;

                    // Store chunk with embedding
                    await session.run(
                        `CREATE (c:Chunk {
                          id: $chunkId,
                          docId: $docId,
                          content: $content,
                          chunkIndex: $index,
                          embedding: $embedding,
                          wordCount: $wordCount,
                          createdAt: datetime()
                        })`,
                        {
                            chunkId: `${docId}_chunk_${i}`,
                            docId: docId,
                            content: chunk,
                            index: i,
                            embedding: embedding,
                            wordCount: chunk.split(' ').length
                        }
                    );

                    // Create relationship
                    await session.run(
                        `MATCH (d:Document {id: $docId})
                         MATCH (c:Chunk {id: $chunkId})
                         CREATE (d)-[:HAS_CHUNK]->(c)`,
                        {
                            docId: docId,
                            chunkId: `${docId}_chunk_${i}`
                        }
                    );

                    allChunks.push(chunk);

                } catch (embeddingError) {
                    logger.error(`Failed to process chunk ${i}:`, embeddingError);
                }
            }

            // Cache the document chunks for BM25 retrieval
            cache.set(`doc_chunks_${docId}`, allChunks);

            logger.info('PDF processing completed successfully');

            res.json({
                message: 'PDF processed and stored successfully',
                id: docId,
                chunksProcessed: chunks.length,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });

        } finally {
            await session.close();
        }

        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

    } catch (err) {
        logger.error('PDF processing error:', err);
        res.status(500).json({
            error: 'Failed to process PDF',
            details: err.message
        });
    }
});

// Enhanced query endpoint with hybrid retrieval
app.post('/query', async (req, res) => {
    const startTime = Date.now();
    let cacheHit = false;

    try {
        // Validate input
        const { error, value } = querySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { question, includeMetadata, maxResults } = value;

        logger.info(`Processing query: ${question}`);

        // Check cache first
        const cacheKey = `query_${Buffer.from(question).toString('base64')}`;
        const cachedResult = cache.get(cacheKey);

        if (cachedResult) {
            cacheHit = true;
            ragMetrics.recordQuery(Date.now() - startTime, true);
            logger.info('Returning cached result');
            return res.json({
                ...cachedResult,
                cached: true,
                responseTime: Date.now() - startTime
            });
        }

        // Generate multiple query variations
        const queryVariations = await generateMultipleQueries(question, 3);
        logger.info(`Generated ${queryVariations.length} query variations`);

        const session = driver.session();

        try {
            // Retrieve all chunks for hybrid search
            const result = await session.run(
                'MATCH (c:Chunk) WHERE c.embedding IS NOT NULL RETURN c'
            );

            if (result.records.length === 0) {
                return res.json({
                    answer: 'No documents have been uploaded yet. Please upload a PDF first.',
                    sources: [],
                    queryVariations: queryVariations,
                    responseTime: Date.now() - startTime
                });
            }

            // Collect all chunks with their data
            const allChunks = result.records.map(record => {
                const chunk = record.get('c').properties;
                return {
                    id: chunk.id,
                    content: chunk.content,
                    embedding: chunk.embedding,
                    docId: chunk.docId,
                    chunkIndex: chunk.chunkIndex
                };
            });

            // Prepare corpus for BM25
            const corpus = allChunks.map(chunk => chunk.content);

            // Hybrid retrieval: combine vector and BM25 scores
            const hybridResults = [];

            for (const queryVariation of queryVariations) {
                // Generate embedding for this query variation
                const questionEmbedding = await embeddingModel.embedContent(queryVariation);
                const queryVector = questionEmbedding.embedding.values;

                // Calculate similarities for each chunk
                for (const chunk of allChunks) {
                    const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
                    const bm25Score = calculateBM25Score(queryVariation, chunk.content, corpus);

                    // Combine scores (weighted hybrid)
                    const hybridScore = (0.7 * vectorScore) + (0.3 * bm25Score);

                    hybridResults.push({
                        chunk: chunk,
                        vectorScore: vectorScore,
                        bm25Score: bm25Score,
                        hybridScore: hybridScore,
                        queryVariation: queryVariation
                    });
                }
            }

            // Sort by hybrid score and remove duplicates
            const uniqueResults = new Map();
            hybridResults.forEach(result => {
                const key = result.chunk.id;
                if (!uniqueResults.has(key) || uniqueResults.get(key).hybridScore < result.hybridScore) {
                    uniqueResults.set(key, result);
                }
            });

            const topResults = Array.from(uniqueResults.values())
                .sort((a, b) => b.hybridScore - a.hybridScore)
                .slice(0, maxResults);

            logger.info(`Found ${topResults.length} relevant chunks using hybrid retrieval`);

            // Prepare context for generation
            const context = topResults
                .map(item => item.chunk.content)
                .join('\n\n');

            // Generate response
            const prompt = `Context: ${context}\n\nQuestion: ${question}\n\nPlease provide a comprehensive answer based on the context above. If the context doesn't contain enough information to answer the question, please say so.`;

            const response = await generationModel.generateContent(prompt);

            let generatedText;
            try {
                generatedText = response.response.text();
            } catch (textError) {
                generatedText = response.response.candidates[0].content.parts[0].text;
            }

            // Evaluate the response
            const evaluation = await ragEvaluator.evaluateRAGResponse(
                question,
                generatedText,
                topResults.map(r => r.chunk)
            );

            const finalResult = {
                answer: generatedText,
                sources: topResults.map(item => ({
                    content: item.chunk.content.substring(0, 200) + '...',
                    vectorScore: item.vectorScore,
                    bm25Score: item.bm25Score,
                    hybridScore: item.hybridScore,
                    docId: item.chunk.docId,
                    chunkIndex: item.chunk.chunkIndex,
                    ...(includeMetadata && { metadata: item.chunk })
                })),
                queryVariations: queryVariations,
                retrievalMethod: 'hybrid',
                evaluation: evaluation,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            // Cache the result
            cache.set(cacheKey, finalResult, 1800); // 30 minutes

            ragMetrics.recordQuery(Date.now() - startTime, false);

            res.json(finalResult);

        } finally {
            await session.close();
        }

    } catch (err) {
        logger.error('Query processing error:', err);
        ragMetrics.recordQuery(Date.now() - startTime, cacheHit, true);
        res.status(500).json({
            error: 'Failed to process query',
            details: err.message,
            responseTime: Date.now() - startTime
        });
    }
});

// Analytics endpoint
app.get('/analytics', async (_req, res) => {
    try {
        const session = driver.session();

        // Get document statistics
        const docStats = await session.run(
            'MATCH (d:Document) RETURN count(d) as totalDocs, avg(size(d.content)) as avgSize'
        );

        // Get chunk statistics
        const chunkStats = await session.run(
            'MATCH (c:Chunk) RETURN count(c) as totalChunks, avg(c.wordCount) as avgWordCount'
        );

        await session.close();

        res.json({
            documents: docStats.records[0].toObject(),
            chunks: chunkStats.records[0].toObject(),
            metrics: ragMetrics.getMetrics(),
            cacheStats: cache.getStats(),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to retrieve analytics' });
    }
});

// Clear cache endpoint
app.post('/admin/clear-cache', async (_req, res) => {
    try {
        cache.flushAll();
        logger.info('Cache cleared successfully');
        res.json({ message: 'Cache cleared successfully' });
    } catch (err) {
        logger.error('Cache clear error:', err);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    logger.info(`🚀 Phase 5 PDF RAG Backend listening on http://localhost:${PORT}`);
    logger.info(`📊 Features: Hybrid Retrieval, Query Transformation, Monitoring, Security, Caching`);
});
