import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/similarity';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 50;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function migrateToHuggingFace() {
    try {
        console.log('Starting migration to HuggingFace embeddings...');

        // Create new table for HuggingFace embeddings
        const { error: createError } = await supabase.rpc('create_hf_embeddings_table');
        if (createError) {
            throw new Error(`Failed to create HF embeddings table: ${createError.message}`);
        }

        // Fetch all courses from the current table
        const { data: courses, error: fetchError } = await supabase
            .from('courses')
            .select('*');

        if (fetchError) {
            throw new Error(`Failed to fetch courses: ${fetchError.message}`);
        }

        console.log(`Found ${courses.length} courses to migrate`);

        // Process courses in batches
        for (let i = 0; i < courses.length; i += BATCH_SIZE) {
            const batch = courses.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(courses.length / BATCH_SIZE)}`);

            await Promise.all(batch.map(async (course) => {
                try {
                    // Prepare course text
                    const courseText = [
                        course.kurskode,
                        course.kursnavn,
                        course.learning_outcome_knowledge,
                        course.course_content
                    ].filter(Boolean).join('\n\n');

                    // Generate new embedding
                    const { embedding } = await generateEmbedding(courseText);

                    // Insert into new table
                    const { error: insertError } = await supabase
                        .from('course_embeddings_hf')
                        .insert({
                            ...course,
                            embedding,
                            embedding_model: 'distiluse-base-multilingual-cased-v2'
                        });

                    if (insertError) {
                        throw new Error(`Failed to insert course ${course.kurskode}: ${insertError.message}`);
                    }

                    console.log(`✓ Migrated ${course.kurskode}`);
                } catch (error) {
                    console.error(`Failed to migrate course ${course.kurskode}:`, error);
                }
            }));

            // Add delay between batches to avoid rate limits
            await delay(1000);
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Execute migration
migrateToHuggingFace(); 