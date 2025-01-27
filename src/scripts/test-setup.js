import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { supabase } from '../services/supabase.js';
import { generateHFEmbedding, prepareCourseText } from '../services/similarity.js';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Verify environment variables are loaded
console.log('Environment variables loaded:', {
    hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
    hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_KEY,
    hasHuggingFaceKey: !!process.env.REACT_APP_HUGGINGFACE_API_KEY
});

async function testSetup() {
    console.log('Starting test setup...');
    try {
        // Test Supabase connection and check table
        console.log('Testing Supabase connection...');
        const { count, error: countError } = await supabase
            .from('openai_embeddings')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Error accessing openai_embeddings table:', {
                message: countError.message,
                details: countError.details,
                hint: countError.hint,
                code: countError.code
            });
            return;
        }
        console.log(`Found ${count} rows in openai_embeddings table`);

        // Test embedding generation
        console.log('Testing embedding generation...');
        const testCourse = {
            kurskode: 'TEST123',
            kursnavn: 'Test Course',
            learning_outcome_knowledge: 'Test knowledge outcomes',
            learning_outcome_skills: 'Test skills outcomes',
            learning_outcome_general_competence: 'Test competence outcomes',
            course_content: 'Test course content'
        };

        const preparedText = prepareCourseText(testCourse);
        console.log('Generated prepared text:', preparedText.substring(0, 100) + '...');

        console.log('Generating embedding (this may take up to 30 seconds on first run)...');
        const embedding = await generateHFEmbedding(preparedText);
        console.log('Generated embedding:', {
            type: typeof embedding,
            isArray: Array.isArray(embedding),
            length: embedding?.length,
            sampleValues: embedding?.slice(0, 3).map(v => v.toFixed(4))
        });

        if (!embedding || embedding.length !== 512) {
            throw new Error(`Invalid embedding generated. Length: ${embedding?.length}`);
        }
        console.log('Successfully generated embedding with correct dimensions');

        // Test storing embedding
        console.log('Testing embedding storage...');
        const { error: insertError } = await supabase
            .from('openai_embeddings')
            .insert({
                ...testCourse,
                hf_embedding: embedding,
                embedding_model: 'distiluse-base-multilingual-cased-v2'
            });

        if (insertError) {
            console.error('Error inserting test course:', {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
            });
            return;
        }
        console.log('Successfully stored test embedding');

        // Clean up test data
        const { error: deleteError } = await supabase
            .from('openai_embeddings')
            .delete()
            .eq('kurskode', 'TEST123');

        if (deleteError) {
            console.error('Error cleaning up test data:', deleteError);
            return;
        }
        console.log('Successfully cleaned up test data');

        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testSetup(); 