import React, { useEffect, useState } from 'react';
import { testHuggingFaceConnection } from '../services/similarity';

function TestHF() {
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function runTest() {
            try {
                const result = await testHuggingFaceConnection();
                setTestResult(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        runTest();
    }, []);

    if (loading) return <div>Testing HuggingFace connection...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!testResult) return <div>No test results available</div>;

    return (
        <div>
            <h2>HuggingFace Connection Test</h2>
            {testResult.success ? (
                <div style={{ color: 'green' }}>
                    <p>✅ Test successful!</p>
                    <p>Embedding dimensions: {testResult.dimensions}</p>
                    <p>Sample values: {JSON.stringify(testResult.sample)}</p>
                </div>
            ) : (
                <div style={{ color: 'red' }}>
                    <p>❌ Test failed: {testResult.error}</p>
                </div>
            )}
        </div>
    );
}

export default TestHF; 