import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

const AppProvider = ({ children }) => {
    const [uploadStatus, setUploadStatus] = useState(null);
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [queryResults, setQueryResults] = useState([]);
    const [isQuerying, setIsQuerying] = useState(false);

    const addDocument = (document) => {
        setUploadedDocuments(prev => [...prev, document]);
    };

    const clearQueryResults = () => {
        setQueryResults([]);
    };

    const value = {
        uploadStatus,
        setUploadStatus,
        uploadedDocuments,
        setUploadedDocuments,
        addDocument,
        queryResults,
        setQueryResults,
        clearQueryResults,
        isQuerying,
        setIsQuerying
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export default AppProvider;
