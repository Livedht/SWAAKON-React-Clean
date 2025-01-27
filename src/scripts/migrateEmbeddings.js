import { createClient } from '@supabase/supabase-js';
import { prepareCourseText, generateHFEmbedding } from '../services/similarity.js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateEmbeddings() {
    console.log('Starting migration to HuggingFace embeddings...');

    try {
        let allCourses = [];
        let page = 0;
        const pageSize = 1000;

        // Fetch all courses using pagination
        while (true) {
            const { data: courses, error } = await supabase
                .from('courses')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;

            if (!courses || courses.length === 0) break;

            allCourses = allCourses.concat(courses);
            page++;
        }

        console.log(`Found ${allCourses.length} courses to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const course of allCourses) {
            try {
                console.log(`\nProcessing ${course.kurskode} (${successCount + errorCount + 1}/${allCourses.length})`);

                // Prepare course text
                const courseText = prepareCourseText(course);
                console.log('Text prepared, length:', courseText.length);

                // Generate new embedding
                const embedding = await generateHFEmbedding(courseText);

                if (!embedding || !Array.isArray(embedding)) {
                    throw new Error('Invalid embedding format received');
                }

                console.log('Embedding generated, dimensions:', embedding.length);

                // Update course with new embedding
                const { error: updateError } = await supabase
                    .from('courses')
                    .update({
                        hf_embedding: embedding,
                        last_updated: new Date().toISOString()
                    })
                    .eq('kurskode', course.kurskode);

                if (updateError) throw updateError;

                console.log(`Successfully updated ${course.kurskode}`);
                successCount++;

                // Add a delay to avoid rate limiting
                await delay(1000);

            } catch (error) {
                console.error(`Error processing ${course.kurskode}:`, error);
                errorCount++;

                // Add a longer delay after errors
                await delay(5000);
            }
        }

        console.log('\nMigration completed!');
        console.log(`Successfully processed: ${successCount}`);
        console.log(`Errors encountered: ${errorCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateEmbeddings(); 