# Neo4j RAG PDF QnA Application

A production-ready React and Node.js application for PDF document processing with Neo4j graph database and Retrieval-Augmented Generation (RAG) capabilities using Google Generative AI.

## Overview

This application enables users to upload PDF documents, extract and store content in a Neo4j graph database with vector embeddings, and query the documents using advanced RAG techniques including hybrid retrieval, query transformation, and intelligent caching.

## Features

### Core Functionality
- PDF upload and text extraction
- Vector embeddings using Google Generative AI (text-embedding-004)
- Neo4j graph database storage with relationships
- Hybrid retrieval combining vector similarity and BM25 scoring
- Query transformation for improved retrieval accuracy
- AI-powered answer generation using Gemini 1.5 Flash

### Advanced Features
- Intelligent caching with NodeCache
- Rate limiting and security with Helmet
- Performance monitoring and metrics
- RAG evaluation (answer relevance, context precision, faithfulness)
- Real-time analytics dashboard
- Comprehensive logging with Winston

## Technology Stack

### Backend
- Node.js with Express.js
- Neo4j Database (neo4j-driver)
- Google Generative AI (Gemini)
- PDF.js for PDF processing
- Natural language processing (natural, compromise)
- Security (helmet, express-rate-limit, joi)
- Logging (winston)
- Caching (node-cache)

### Frontend
- React 18 with Hooks
- React Router for navigation
- Context API for state management
- React Dropzone for file uploads
- Recharts for analytics visualization
- Axios for API communication

## Prerequisites

1. Node.js LTS (v18 or higher) - Download from [nodejs.org](https://nodejs.org/)
2. Neo4j Desktop or Neo4j Server - Download from [neo4j.com](https://neo4j.com/download/)
3. Google Generative AI API Key - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Windows-Specific Requirements
- Allow port 7687 for Neo4j in Windows Firewall
- Ensure PowerShell execution policy allows script execution

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Khanna-Aman/Neo4j-RAG-PDF-QnA.git
cd Neo4j-RAG-PDF-QnA
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
GEMINI_API_KEY=your_google_ai_api_key
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

### 4. Neo4j Database Setup

1. Open Neo4j Desktop
2. Create a new project
3. Create a new database instance
4. Start the database
5. Set the password (use this in your `.env` file)
6. Ensure the database is running on bolt://localhost:7687

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend server will start on http://localhost:5000

### Start Frontend Development Server

```bash
cd frontend
npm start
```

The frontend will start on http://localhost:3000

## Usage

### Uploading Documents

1. Navigate to the main page
2. Drag and drop a PDF file or click to select
3. Wait for processing to complete
4. The document will be chunked and stored with vector embeddings

### Querying Documents

1. Enter your question in the query input field
2. Optionally adjust settings:
   - Include metadata: Show additional chunk information
   - Max results: Number of relevant chunks to retrieve (3-20)
3. Click "Search" to get AI-generated answers
4. View:
   - AI-generated answer
   - Query variations used
   - Relevant source chunks with similarity scores
   - Response time and caching status

### Analytics Dashboard

1. Navigate to the Analytics tab
2. View system metrics:
   - Document and chunk statistics
   - Performance metrics (response time, cache hit rate)
   - Cache statistics
   - Performance charts
3. Clear cache if needed using the "Clear Cache" button

## API Endpoints

### Health Check
```
GET /health
```
Returns system status including Neo4j, Gemini API, cache, and performance metrics.

### Upload PDF
```
POST /upload
```
Upload and process a PDF document. Returns document ID and processing statistics.

### Query Documents
```
POST /query
```
Query uploaded documents with RAG. Supports hybrid retrieval and query transformation.

Request body:
```json
{
  "question": "Your question here",
  "includeMetadata": false,
  "maxResults": 5
}
```

### Analytics
```
GET /analytics
```
Retrieve system analytics including document stats, chunk stats, and performance metrics.

### Clear Cache
```
POST /admin/clear-cache
```
Clear the application cache.

## Architecture

### Data Flow

1. **Upload Flow**:
   - User uploads PDF via React frontend
   - Backend receives file via Multer
   - PDF.js extracts text content
   - Text is chunked (1000 characters per chunk)
   - Each chunk is embedded using Google Generative AI
   - Chunks stored in Neo4j with embeddings and relationships

2. **Query Flow**:
   - User submits question
   - System generates query variations
   - Hybrid retrieval:
     - Vector similarity search using embeddings
     - BM25 keyword-based scoring
     - Combined weighted scoring (70% vector, 30% BM25)
   - Top chunks retrieved
   - Context sent to Gemini for answer generation
   - Response evaluated for quality metrics
   - Result cached for future queries

### Neo4j Schema

**Nodes**:
- `Document`: Represents uploaded PDF documents
  - Properties: id, title, content, uploadedAt, processingTime
- `Chunk`: Represents text chunks from documents
  - Properties: id, docId, content, chunkIndex, embedding, wordCount, createdAt

**Relationships**:
- `(Document)-[:HAS_CHUNK]->(Chunk)`

## Performance Optimization

- Intelligent caching with 30-minute TTL
- Rate limiting (100 requests per 15 minutes)
- Query result caching
- Hybrid retrieval for improved accuracy
- Chunk-based processing for large documents
- Connection pooling for Neo4j

## Security Features

- Helmet.js for HTTP security headers
- CORS configuration
- Rate limiting
- Input validation with Joi
- File type validation (PDF only)
- File size limits (10MB)
- Environment variable protection

## Monitoring and Logging

- Winston logger with file and console transports
- Error logging to `logs/error.log`
- Combined logging to `logs/combined.log`
- Performance metrics tracking
- Real-time health monitoring

## Troubleshooting

### Neo4j Connection Issues
- Verify Neo4j is running in Neo4j Desktop
- Check credentials in `.env` file
- Ensure port 7687 is not blocked by firewall
- Verify bolt://localhost:7687 is accessible

### API Key Issues
- Verify GEMINI_API_KEY is correct
- Check API quota and limits
- Ensure API key has necessary permissions

### Upload Failures
- Check file size (must be under 10MB)
- Verify file is a valid PDF
- Check backend logs for detailed errors

### Query Issues
- Ensure documents have been uploaded first
- Check backend connectivity
- Verify Neo4j has stored chunks
- Review logs for embedding errors

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm start  # React development server with hot reload
```

### Production Build
```bash
cd frontend
npm run build
```

## Project Structure

```
Neo4j-RAG-PDF-QnA/
├── backend/
│   ├── logs/              # Application logs
│   ├── uploads/           # Temporary PDF storage
│   ├── .env              # Environment variables
│   ├── neo4j.js          # Neo4j driver configuration
│   ├── server.js         # Main Express server
│   ├── package.json      # Backend dependencies
│   └── package-lock.json
├── frontend/
│   ├── public/
│   │   └── index.html    # HTML template
│   ├── src/
│   │   ├── components/
│   │   │   ├── Analytics.js  # Analytics dashboard
│   │   │   ├── Query.js      # Query interface
│   │   │   └── Upload.js     # Upload interface
│   │   ├── App.css       # Application styles
│   │   ├── App.js        # Main App component
│   │   ├── AppContext.js # Global state management
│   │   ├── index.css     # Global styles
│   │   └── index.js      # React entry point
│   ├── package.json      # Frontend dependencies
│   └── package-lock.json
├── README.md             # This file
├── Step1.md             # Development guide - Phase 1
├── Step2.md             # Development guide - Phase 2
├── Step3.md             # Development guide - Phase 3
└── Step4.md             # Development guide - Phase 4
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is available for educational and personal use.

## Acknowledgments

- Google Generative AI for embeddings and generation
- Neo4j for graph database capabilities
- React and Node.js communities
- PDF.js for PDF processing

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the Step guides for detailed implementation information
