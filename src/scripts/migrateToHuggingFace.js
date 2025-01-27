import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prepareCourseText, generateHFEmbedding } from '../services/similarity.js';

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

async function migrateCourses() {
    console.log('Starting migration...');
    let successCount = 0;
    let errorCount = 0;
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    try {
        while (hasMore) {
            // Fetch courses with pagination
            const { data: courses, error } = await supabase
                .from('courses')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;

            if (!courses || courses.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`\nProcessing page ${page + 1} with ${courses.length} courses`);

            for (let i = 0; i < courses.length; i++) {
                const course = courses[i];
                const totalProcessed = page * pageSize + i + 1;
                console.log(`\nProcessing ${course.kurskode} (${totalProcessed}/${(page * pageSize) + courses.length})`);

                try {
                    // Prepare the text for embedding
                    const text = prepareCourseText(course);
                    console.log(`Text prepared, length: ${text.length}`);

                    // Generate embedding
                    const embedding = await generateHFEmbedding(text);
                    console.log('Generated embedding via API');
                    console.log(`Vector dimensions: ${embedding.length}`);
                    console.log('Sample values:', embedding.slice(0, 5));

                    // Upsert into openai_embeddings table
                    const { error: updateError } = await supabase
                        .from('openai_embeddings')
                        .upsert({
                            kurskode: course.kurskode,
                            kursnavn: course.kursnavn,
                            semester: course.semester,
                            school: course.school,
                            språk: course.språk,
                            active_status: course.active_status,
                            academic_coordinator: course.academic_coordinator,
                            portfolio: course.portfolio,
                            learning_outcome_knowledge: course.learning_outcome_knowledge,
                            learning_outcome_skills: course.learning_outcome_skills,
                            learning_outcome_general_competence: course.learning_outcome_general_competence,
                            course_content: course.course_content,
                            kursansvarlig: course.kursansvarlig,
                            credits: course.credits,
                            ansvarlig_institutt: course.ansvarlig_institutt,
                            ansvarlig_område: course.ansvarlig_område,
                            undv_språk: course.undv_språk,
                            link_en: course.link_en,
                            link_nb: course.link_nb,
                            level_of_study: course.level_of_study,
                            pensum: course.pensum,
                            campus: course.campus,
                            hf_embedding: embedding,
                            embedding_model: 'sentence-transformers/distiluse-base-multilingual-cased-v2'
                        }, {
                            onConflict: 'kurskode'
                        });

                    if (updateError) {
                        console.log('Update error:', updateError);
                        throw updateError;
                    }

                    successCount++;
                    console.log(`Successfully processed ${course.kurskode}`);

                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (err) {
                    console.log(`Error processing ${course.kurskode}:`, err);
                    errorCount++;

                    if (errorCount >= 10) {
                        console.log('Too many errors encountered, stopping migration');
                        hasMore = false;
                        break;
                    }
                }
            }

            page++;
        }

    } catch (err) {
        console.error('Migration error:', err);
    }

    console.log('\nMigration completed!');
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
}

migrateCourses(); 