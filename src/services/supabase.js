import { createClient } from '@supabase/supabase-js';

// Legg til debugging for å se hva som faktisk blir hentet
console.log('Supabase Config Debug:', {
    url: process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
    hasKey: !!(process.env.REACT_APP_SUPABASE_KEY || process.env.SUPABASE_KEY)
});

// Sørg for at URL-en er gyldig
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost';
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || process.env.SUPABASE_KEY || 'dummy-key';

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_KEY) {
    console.error('Missing Supabase configuration:', {
        hasUrl: !!process.env.REACT_APP_SUPABASE_URL,
        hasKey: !!process.env.REACT_APP_SUPABASE_KEY
    });
}

// Sjekk at URL-en er gyldig før vi oppretter klienten
try {
    new URL(supabaseUrl);
} catch (error) {
    console.error('Invalid Supabase URL:', supabaseUrl);
}

export const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);

// Constants for rate limiting and quotas
const RATE_LIMIT_PER_MINUTE = 10;
const DAILY_QUOTA = 100;
const COST_THRESHOLD = 5.0; // USD

// Track request timestamps for rate limiting
const requestLog = new Map();

export const checkRateLimit = async (userId) => {
    const now = Date.now();
    const userRequests = requestLog.get(userId) || [];

    // First check if user is admin
    const { data: userData, error: roleError } = await supabase
        .from('user_roles')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

    if (roleError) {
        console.error('Error checking admin status:', roleError);
    } else if (userData?.is_admin) {
        console.log('Admin user - bypassing rate limits');
        return true;
    }

    // Clean up old requests (older than 1 minute)
    const recentRequests = userRequests.filter(time => now - time < 60000);

    if (recentRequests.length >= RATE_LIMIT_PER_MINUTE) {
        throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }

    // Add current request
    recentRequests.push(now);
    requestLog.set(userId, recentRequests);

    try {
        // First, try to get the user stats
        const { data: usageData, error: usageError } = await supabase
            .from('user_stats')
            .select('daily_requests, daily_cost')
            .eq('user_id', userId)
            .single();

        // If no data exists, create a new entry
        if (usageError && usageError.code === 'PGRST116') {
            const { error: insertError } = await supabase
                .from('user_stats')
                .insert({
                    user_id: userId,
                    daily_requests: 1,
                    daily_cost: 0,
                    last_request: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;
            return true;
        }

        if (usageError) throw usageError;

        // Skip quota check for admin users
        if (!userData?.is_admin) {
            if (usageData.daily_requests >= DAILY_QUOTA) {
                throw new Error('Daily quota exceeded. Please try again tomorrow.');
            }

            if (usageData.daily_cost >= COST_THRESHOLD) {
                throw new Error('Daily cost threshold exceeded. Please contact administrator.');
            }
        }

        // Update usage statistics
        const { error: updateError } = await supabase
            .from('user_stats')
            .update({
                daily_requests: (usageData.daily_requests || 0) + 1,
                last_request: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select();

        if (updateError) throw updateError;

        return true;
    } catch (error) {
        console.error('Error in checkRateLimit:', error);
        throw error;
    }
};

export const trackApiCost = async (userId, cost, endpoint) => {
    try {
        // Skip cost tracking for embeddings since we're using local HuggingFace model
        if (endpoint === 'course_comparison') {
            return;
        }

        // First, ensure user_stats exists
        const { data: statsData, error: statsError } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (statsError && statsError.code === 'PGRST116') {
            // Create user_stats if it doesn't exist
            const { error: createError } = await supabase
                .from('user_stats')
                .insert({
                    user_id: userId,
                    daily_requests: 0,
                    daily_cost: cost,
                    last_request: new Date().toISOString()
                });

            if (createError) throw createError;
        } else if (statsError) {
            throw statsError;
        } else {
            // Update daily cost if stats exist
            const { error: updateError } = await supabase
                .from('user_stats')
                .update({
                    daily_cost: statsData.daily_cost + cost
                })
                .eq('user_id', userId);

            if (updateError) throw updateError;
        }

        // For GPT-4, estimate tokens based on cost
        const tokens_used = Math.round(cost / 0.01 * 1000); // GPT-4 cost is roughly $0.01/1K tokens

        // Log the API cost
        const { error } = await supabase
            .from('api_costs')
            .insert({
                user_id: userId,
                cost_usd: cost,
                endpoint: endpoint,
                model: 'gpt-4-turbo',
                tokens_used: tokens_used,
                timestamp: new Date().toISOString()
            });

        if (error) throw error;

        // Check if user has exceeded cost threshold
        if (statsData && statsData.daily_cost + cost >= COST_THRESHOLD) {
            await notifyAdmins(userId, statsData.daily_cost + cost);
        }
    } catch (error) {
        console.error('Error tracking API cost:', error);
        // Don't throw the error - just log it
        // This prevents the main comparison flow from breaking if cost tracking fails
    }
};

const notifyAdmins = async (userId, cost) => {
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const message = `User ${user.email} has exceeded the daily cost threshold (${cost.toFixed(2)} USD)`;

    // Insert notification for admins
    await supabase
        .from('admin_notifications')
        .insert({
            message,
            type: 'cost_alert',
            created_at: new Date().toISOString()
        });
};

// Reset daily stats at midnight
const resetDailyStats = async () => {
    const { error } = await supabase
        .from('user_stats')
        .update({
            daily_requests: 0,
            daily_cost: 0
        });

    if (error) console.error('Error resetting daily stats:', error);
};

// Set up daily reset
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const timeUntilMidnight = tomorrow - now;

setTimeout(() => {
    resetDailyStats();
    // Set up recurring daily reset
    setInterval(resetDailyStats, 24 * 60 * 60 * 1000);
}, timeUntilMidnight);

// Fetch all course data from original table
export const fetchAllCourses = async () => {
    try {
        console.log('Fetching all courses from Supabase');
        const { data, error } = await supabase
            .from('openai_embeddings')
            .select('*');

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('Sample course data:', data[0]);
        console.log('Fields available:', data[0] ? Object.keys(data[0]) : 'No data');
        console.log(`Fetched ${data.length} courses`);
        return data;
    } catch (error) {
        console.error('Error fetching courses:', error);
        throw error;
    }
};

// Create new table for OpenAI embeddings
export const createOpenAIEmbeddingsTable = async () => {
    try {
        const { error } = await supabase
            .rpc('create_openai_embeddings_table');

        if (error) {
            console.error('Error creating table:', error);
            throw error;
        }
        console.log('Successfully created openai_embeddings table');
    } catch (error) {
        console.error('Error in createOpenAIEmbeddingsTable:', error);
        throw error;
    }
};

// Store course with embedding
export const storeCourseWithEmbedding = async (courseData, embedding, model = 'openai') => {
    try {
        const tableName = model.includes('distiluse') ? 'huggingface_embeddings' : 'openai_embeddings';
        console.log(`Storing course ${courseData.kurskode} with ${model} embedding in ${tableName}`);

        const { error } = await supabase
            .from(tableName)
            .insert([{
                kurskode: courseData.kurskode,
                kursnavn: courseData.kursnavn,
                credits: courseData.credits,
                level_of_study: courseData.level_of_study,
                academic_coordinator: courseData.academic_coordinator,
                ansvarlig_institutt: courseData.ansvarlig_institutt,
                ansvarlig_område: courseData.ansvarlig_område,
                undv_språk: courseData.undv_språk,
                portfolio: courseData.portfolio,
                learning_outcome_knowledge: courseData.learning_outcome_knowledge,
                learning_outcome_skills: courseData.learning_outcome_skills,
                learning_outcome_general_competence: courseData.learning_outcome_general_competence,
                course_content: courseData.course_content,
                embedding: embedding,
                embedding_model: model
            }]);

        if (error) {
            console.error('Error storing course with embedding:', error);
            throw error;
        }
        console.log(`Successfully stored course ${courseData.kurskode} with ${model} embedding`);
    } catch (error) {
        console.error(`Error storing course ${courseData.kurskode}:`, error);
        throw error;
    }
};

// Fetch courses with OpenAI embeddings
export const fetchOpenAIEmbeddings = async () => {
    try {
        console.log('Fetching courses with OpenAI embeddings');
        const { data, error } = await supabase
            .from('openai_embeddings')
            .select('*');

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        const processedCourses = data.map(course => ({
            ...course,
            embedding: typeof course.embedding === 'string' ?
                JSON.parse(course.embedding) : course.embedding
        }));

        console.log(`Fetched ${processedCourses.length} courses with OpenAI embeddings`);
        return processedCourses;
    } catch (error) {
        console.error('Error fetching OpenAI embeddings:', error);
        throw error;
    }
};

export const fetchStoredEmbeddings = async () => {
    try {
        console.log('Fetching stored embeddings from Supabase');

        // First, get the total count
        const { count } = await supabase
            .from('openai_embeddings')
            .select('*', { count: 'exact', head: true });

        console.log('Total courses in database:', count);

        // Fetch all courses in chunks
        const pageSize = 1000;
        const pages = Math.ceil(count / pageSize);
        let allData = [];

        for (let i = 0; i < pages; i++) {
            const { data, error } = await supabase
                .from('openai_embeddings')
                .select(`
                    kurskode,
                    kursnavn,
                    credits,
                    level_of_study,
                    språk,
                    semester,
                    portfolio,
                    ansvarlig_institutt,
                    ansvarlig_område,
                    academic_coordinator,
                    hf_embedding,
                    course_content,
                    learning_outcome_knowledge,
                    learning_outcome_skills,
                    learning_outcome_general_competence
                `)
                .range(i * pageSize, (i + 1) * pageSize - 1);

            if (error) {
                console.error('Supabase error:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            // Add detailed debug logging for course content
            if (data && data[0]) {
                console.log('Sample course content check:', {
                    kurskode: data[0].kurskode,
                    hasContent: !!data[0].course_content,
                    contentLength: data[0].course_content?.length || 0,
                    hasKnowledge: !!data[0].learning_outcome_knowledge,
                    knowledgeLength: data[0].learning_outcome_knowledge?.length || 0,
                    hasSkills: !!data[0].learning_outcome_skills,
                    skillsLength: data[0].learning_outcome_skills?.length || 0,
                    hasCompetence: !!data[0].learning_outcome_general_competence,
                    competenceLength: data[0].learning_outcome_general_competence?.length || 0
                });
            }

            allData = [...allData, ...data];
            console.log(`Fetched page ${i + 1}/${pages}, got ${data.length} courses`);
        }

        console.log('Total courses fetched:', allData.length);

        // Process the embeddings
        const processedCourses = allData.map(course => {
            // Handle the embedding field
            let processedEmbedding;
            if (course.hf_embedding) {
                try {
                    // Convert the vector to an array of numbers if it's a string
                    processedEmbedding = typeof course.hf_embedding === 'string'
                        ? course.hf_embedding.slice(1, -1).split(',').map(Number)
                        : course.hf_embedding;

                    // Verify embedding is valid
                    if (!Array.isArray(processedEmbedding) || processedEmbedding.length !== 512) {
                        console.error(`Invalid embedding dimensions for course ${course.kurskode}: ${processedEmbedding.length}`);
                        console.log('Sample of embedding:', processedEmbedding.slice(0, 5));
                        return null;
                    }
                } catch (e) {
                    console.error(`Error processing embedding for course ${course.kurskode}:`, e);
                    return null;
                }
            } else {
                console.error(`No embedding found for course ${course.kurskode}`);
                return null;
            }

            return {
                ...course,
                embedding: processedEmbedding
            };
        }).filter(course => course !== null);

        console.log('Processing summary:', {
            totalCoursesBeforeProcessing: allData.length,
            validCoursesAfterProcessing: processedCourses.length
        });

        return processedCourses;
    } catch (error) {
        console.error('Error in fetchStoredEmbeddings:', error);
        throw error;
    }
};

export const updateCourseEmbedding = async (courseCode, embedding) => {
    try {
        console.log('Updating embedding for course:', courseCode);
        const { error } = await supabase
            .from('openai_embeddings')
            .update({ hf_embedding: embedding })
            .eq('kurskode', courseCode);

        if (error) {
            console.error('Supabase error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        console.log('Successfully updated embedding');
    } catch (error) {
        console.error('Detailed error in updateCourseEmbedding:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

export const checkIsAdmin = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('No user found');
            return false;
        }

        console.log('Checking admin status for user:', user.id);

        const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('Database error:', error);
            throw error;
        }

        console.log('Admin check result:', data);
        return data?.is_admin || false;
    } catch (error) {
        console.error('Detailed error in checkIsAdmin:', error);
        return false;
    }
};

export const saveSearchHistory = async (userId, searchData) => {
    const { error } = await supabase
        .from('search_history')
        .insert([{
            user_id: userId,
            course_name: searchData.courseName,
            timestamp: new Date(),
            results_count: searchData.resultsCount
        }]);

    if (error) console.error('Error saving search history:', error);
};

// Search History Functions
export const saveSearch = async (searchData) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Prepare the data with reduced size
        const processedResults = searchData.results.slice(0, 50).map(result => ({
            kurskode: result.kurskode,
            kursnavn: result.kursnavn,
            similarity: result.similarity,
            credits: result.credits,
            level_of_study: result.level_of_study,
            språk: result.språk,
            semester: result.semester,
            portfolio: result.portfolio,
            område: result.område,
            academic_coordinator: result.academic_coordinator,
            institutt: result.institutt,
            link_nb: result.link_nb
        }));

        const searchEntry = {
            user_id: user.id,
            search_input: {
                courseName: searchData.search_input.courseName,
                courseDescription: searchData.search_input.courseDescription.slice(0, 1000), // Limit description length
                courseLiterature: searchData.search_input.courseLiterature?.slice(0, 500) || '' // Limit literature length
            },
            table_settings: {
                activeColumns: searchData.table_settings.activeColumns,
                filters: searchData.table_settings.filters
            },
            results: processedResults,
            created_at: new Date().toISOString()
        };

        // Delete oldest search if limit reached
        const { count } = await supabase
            .from('search_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

        if (count >= 5) {
            const { data: oldestSearch } = await supabase
                .from('search_history')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (oldestSearch) {
                await supabase
                    .from('search_history')
                    .delete()
                    .eq('id', oldestSearch.id);
            }
        }

        // Insert new search with timeout handling
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 10000)
        );

        const insertPromise = supabase
            .from('search_history')
            .insert(searchEntry)
            .select()
            .single();

        const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

        if (error) {
            console.error('Error saving search:', error);
            return null; // Return null instead of throwing
        }

        return data;
    } catch (error) {
        console.error('Error in saveSearch:', error);
        return null; // Return null instead of throwing
    }
};

export const getSearchHistory = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('search_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error('Error fetching search history:', error);
        throw error;
    }
};

export const getSearchById = async (searchId) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('search_history')
            .select('*')
            .eq('id', searchId)
            .eq('user_id', user.id)  // Ensure user can only access their own searches
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching search:', error);
        throw error;
    }
};

export const deleteSearch = async (searchId) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('search_history')
            .delete()
            .eq('id', searchId)
            .eq('user_id', user.id);  // Ensure user can only delete their own searches

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting search:', error);
        throw error;
    }
}; 