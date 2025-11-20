import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppContext } from '../AppContext';

const Upload = () => {
    const { uploadStatus, setUploadStatus, addDocument } = useAppContext();

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];

        if (!file) return;

        if (file.type !== 'application/pdf') {
            setUploadStatus({
                type: 'error',
                message: 'Please select a PDF file'
            });
            return;
        }

        setUploadStatus({
            type: 'loading',
            message: 'Uploading and processing PDF...'
        });

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            setUploadStatus({
                type: 'success',
                message: `PDF processed successfully! Created ${result.chunksProcessed} chunks.`
            });

            addDocument({
                id: result.id,
                filename: file.name,
                uploadedAt: new Date().toISOString(),
                chunks: result.chunksProcessed
            });

            // Clear status after 5 seconds
            setTimeout(() => setUploadStatus(null), 5000);

        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus({
                type: 'error',
                message: `Upload failed: ${error.message}`
            });
        }
    }, [setUploadStatus, addDocument]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        multiple: false
    });

    return (
        <div className="upload-section">
            <h2>📄 Upload PDF Document</h2>
            <div
                {...getRootProps()}
                className={`dropzone ${isDragActive ? 'active' : ''}`}
            >
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p>Drop the PDF here...</p>
                ) : (
                    <div>
                        <p>Drag & drop a PDF file here, or click to select</p>
                        <p style={{ fontSize: '14px', color: '#666' }}>
                            The document will be processed and stored with vector embeddings
                        </p>
                    </div>
                )}
            </div>

            {uploadStatus && (
                <div className={`upload-status ${uploadStatus.type}`}>
                    {uploadStatus.message}
                </div>
            )}
        </div>
    );
};

export default Upload;
