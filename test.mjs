import { testHuggingFaceConnection } from './src/services/similarity.js';

async function runTest() {
    console.log('Starting HuggingFace API test...');

    try {
        const result = await testHuggingFaceConnection();

        if (result.success) {
            console.log('✅ Test successful!');
            console.log('Model output dimensions:', result.dimensions);
            console.log('Sample values:', result.sample);
        } else {
            console.error('❌ Test failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

runTest(); 