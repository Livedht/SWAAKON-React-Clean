import OpenAI from 'openai';
import { supabase } from './supabase';

const apiKey = process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

console.log('OpenAI Config Debug:', {
    hasKey: !!apiKey
});

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
});

// Legg til disse konstantene øverst i filen
const COST_PER_1K_TOKENS = {
    'gpt-3.5-turbo-0125': {  // Nyeste og billigste versjonen
        input: 0.0001,   // $0.0001 / 1K tokens
        output: 0.0002   // $0.0002 / 1K tokens
    },
    'text-embedding-3-large': {
        input: 0.00013,
        output: 0.00013
    }
};

// Cache for translations
const analysisCache = new Map();

// Funksjon for å logge API-kostnader
const logApiCost = async (endpoint, model, inputTokens, outputTokens = 0) => {
    try {
        const inputCost = (inputTokens / 1000) * COST_PER_1K_TOKENS[model].input;
        const outputCost = (outputTokens / 1000) * COST_PER_1K_TOKENS[model].output;
        const totalCost = inputCost + outputCost;

        // Hent gjeldende bruker
        const { data: { user } } = await supabase.auth.getUser();

        console.log('Logging API cost:', {
            endpoint,
            model,
            inputTokens,
            outputTokens,
            totalCost,
            user: user?.email
        });

        const { data, error } = await supabase
            .from('api_costs')
            .insert([{
                endpoint,
                model,
                tokens_used: inputTokens + outputTokens,
                cost_usd: totalCost,
                user_id: user?.id,
                user_email: user?.email
            }])
            .select();

        if (error) {
            console.error('Error inserting API cost:', error);
            throw error;
        }

        console.log('Successfully logged API cost:', data);
        return data;
    } catch (error) {
        console.error('Error in logApiCost:', error);
    }
};

// Function to detect if text is in English
const isEnglishText = (text) => {
    // Count Norwegian and English specific characters/words
    const norwegianChars = (text.match(/[æøåÆØÅ]/g) || []).length;
    const norwegianWords = (text.match(/\b(og|eller|som|ved|fra|til|mellom|etter|før|under|over|mot|hos|der|når|hvis|skal|må|kan|vil|har|blir|ble|være|blitt)\b/gi) || []).length;
    const englishWords = (text.match(/\b(the|and|or|as|by|from|to|between|after|before|under|over|against|at|when|if|shall|must|can|will|have|become|became|being|been)\b/gi) || []).length;

    // Calculate language scores
    const norwegianScore = norwegianChars * 2 + norwegianWords;
    const englishScore = englishWords;

    // If text has strong indicators of Norwegian, classify as Norwegian
    if (norwegianScore > englishScore * 1.5) {
        return false;
    }

    // If text has strong indicators of English, classify as English
    if (englishScore > norwegianScore * 1.5) {
        return true;
    }

    // For ambiguous cases, check for more specific patterns
    const hasNorwegianStructures = /\b(skal\s+\w+e|å\s+\w+e|kan\s+\w+e)\b/i.test(text);
    const hasEnglishStructures = /\b(will\s+\w+|to\s+\w+|can\s+\w+)\b/i.test(text);

    if (hasNorwegianStructures && !hasEnglishStructures) {
        return false;
    }
    if (hasEnglishStructures && !hasNorwegianStructures) {
        return true;
    }

    // Default to treating ambiguous text as Norwegian for academic content
    return false;
};

// Function to translate text between Norwegian and English
const translateText = async (text, targetLanguage) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: `You are a professional academic translator specializing in course descriptions and educational content.
                    Your task is to translate the following text to ${targetLanguage === 'en' ? 'English' : 'Norwegian (Bokmål)'}.
                    
                    Guidelines:
                    1. Maintain academic terminology and technical terms in their proper form
                    2. Preserve the formal tone and academic style
                    3. Keep course-specific terms consistent
                    4. Maintain the original structure and formatting
                    5. Preserve learning outcomes and competency descriptions accurately
                    6. Use standard academic vocabulary for the target language
                    7. Keep pedagogical terms consistent with educational standards
                    
                    For Norwegian translations:
                    - Use modern Bokmål
                    - Follow UHR's terminology standards
                    - Maintain academic Norwegian style
                    
                    For English translations:
                    - Use international academic English
                    - Follow standard academic terminology
                    - Maintain clarity for international audiences`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        });

        await logApiCost(
            'translation',
            'gpt-4-turbo-preview',
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
};

// Function to remove stopwords and clean text
const removeStopwords = (text) => {
    // Common stopwords in both Norwegian and English
    const stopwords = new Set([
        'og', 'i', 'jeg', 'det', 'at', 'en', 'et', 'den', 'til', 'er', 'som', 'på', 'de', 'med', 'han', 'av', 'ikke',
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as'
    ]);

    // Split text into words, convert to lowercase, and filter out stopwords
    return text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')  // Remove punctuation
        .split(/\s+/)
        .filter(word => !stopwords.has(word) && word.length > 1)  // Remove stopwords and single characters
        .join(' ');
};

// Function to clean and format text
const cleanText = (text) => {
    if (!text) return '';

    return text
        .toLowerCase()
        .replace(/[^\w\såøæ]/g, ' ')  // Replace non-word chars (except Nordic) with space
        .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
        .trim();
};

// Function to extract core concepts from text
const extractCoreConcepts = (text) => {
    if (!text) return '';

    // Strategy-specific terms in both languages
    const conceptPatterns = [
        // Core strategy concepts
        /\b(?:strategi|strategy)\b.{0,30}/gi,
        /\b(?:verdiskaping|value creation)\b.{0,30}/gi,
        /\b(?:konkurransefortrinn|competitive advantage)\b.{0,30}/gi,
        /\b(?:forretningsmodell|business model)\b.{0,30}/gi,
        /\b(?:visjon|vision)\b.{0,30}/gi,
        /\b(?:misjon|mission)\b.{0,30}/gi,

        // Strategic analysis
        /\b(?:swot|pestel?)\b.{0,30}/gi,
        /\b(?:porters? five forces)\b.{0,30}/gi,
        /\b(?:ekstern analyse|external analysis)\b.{0,30}/gi,
        /\b(?:intern analyse|internal analysis)\b.{0,30}/gi,
        /\b(?:ressursanalyse|resource analysis)\b.{0,30}/gi,

        // Strategic implementation
        /\b(?:implementering|implementation)\b.{0,30}/gi,
        /\b(?:organisering|organization)\b.{0,30}/gi,
        /\b(?:strategisk ledelse|strategic management)\b.{0,30}/gi,
        /\b(?:strategiske valg|strategic choices)\b.{0,30}/gi,

        // Strategic focus areas
        /\b(?:innovasjon|innovation)\b.{0,30}/gi,
        /\b(?:bærekraft|sustainability)\b.{0,30}/gi,
        /\b(?:samfunnsansvar|corporate responsibility)\b.{0,30}/gi,
        /\b(?:digitalisering|digitalization)\b.{0,30}/gi
    ];

    let concepts = new Set();
    conceptPatterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[0] && match[0].trim().length > 3) {
                concepts.add(cleanText(match[0]));
            }
        }
    });

    return Array.from(concepts).join('\n');
};

// Function to detect subject area from content
const detectSubjectArea = (text) => {
    if (!text) return 'Unknown';

    // Define subject area indicators (keywords and their context)
    const subjectIndicators = {
        Strategy: [
            /\b(?:strategi|strategy)\b/i,
            /\b(?:competitive|konkurransefortrinn)\b/i,
            /\b(?:verdiskaping|value creation)\b/i,
            /\b(?:strategic|strategisk)\b/i,
            /\b(?:business model|forretningsmodell)\b/i,
            /\bswot\b/i,
            /\bpestel?\b/i,
            /\bporters?\b/i
        ],
        Marketing: [
            /\b(?:marketing|markedsføring)\b/i,
            /\b(?:brand|merkevare)\b/i,
            /\b(?:customer|kunde)\b/i,
            /\b(?:segment|målgruppe)\b/i,
            /\b(?:promotion|markedskommunikasjon)\b/i
        ],
        Economics: [
            /\b(?:economics|økonomi)\b/i,
            /\b(?:macro|mikro|makro)\b/i,
            /\b(?:equilibrium|likevekt)\b/i,
            /\b(?:demand|supply|tilbud|etterspørsel)\b/i,
            /\b(?:market structure|markedsstruktur)\b/i
        ],
        Finance: [
            /\b(?:finance|finans)\b/i,
            /\b(?:investment|investering)\b/i,
            /\b(?:portfolio|portefølje)\b/i,
            /\b(?:stock|aksje)\b/i,
            /\b(?:risk|risiko)\b/i
        ],
        Organization: [
            /\b(?:organization|organisasjon)\b/i,
            /\b(?:leadership|ledelse)\b/i,
            /\b(?:culture|kultur)\b/i,
            /\b(?:change management|endringsledelse)\b/i,
            /\b(?:structure|struktur)\b/i
        ]
    };

    // Count matches for each subject area
    const scores = {};
    Object.entries(subjectIndicators).forEach(([subject, patterns]) => {
        scores[subject] = patterns.reduce((count, pattern) => {
            const matches = text.match(pattern) || [];
            return count + matches.length;
        }, 0);
    });

    // Find the subject with the highest score
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);

    // If the highest score is significantly higher than others, use it
    if (entries[0][1] > 0 && (entries.length === 1 || entries[0][1] >= entries[1][1] * 1.5)) {
        return entries[0][0];
    }

    // If we have multiple strong matches, combine them
    const strongMatches = entries.filter(([_, score]) => score > 0 && score >= entries[0][1] * 0.7);
    if (strongMatches.length > 1) {
        return strongMatches.map(([subject]) => subject).join('/');
    }

    return entries[0][1] > 0 ? entries[0][0] : 'Other';
};

// Function to prepare course text for embedding
const prepareCourseText = (course) => {
    // Extract all relevant course information
    const {
        name,
        content,
        literature,
        learning_outcome_knowledge,
        learning_outcome_skills,
        learning_outcome_general_competence,
        course_content,
        credits,
        level_of_study
    } = course;

    // Combine all text for subject detection
    const fullText = `
        ${name || ''}
        ${learning_outcome_knowledge || ''}
        ${learning_outcome_skills || ''}
        ${learning_outcome_general_competence || ''}
        ${course_content || content || ''}
    `;

    // Detect subject area from content
    const subjectArea = detectSubjectArea(fullText);

    // Structure the text to emphasize important aspects
    const structuredText = `
SUBJECT AREA:
${subjectArea}

COURSE TITLE AND BASICS:
${name}
Credits: ${credits || 'N/A'}
Level: ${level_of_study || 'N/A'}

LEARNING OUTCOMES:
Knowledge:
${learning_outcome_knowledge || ''}

Skills:
${learning_outcome_skills || ''}

General Competence:
${learning_outcome_general_competence || ''}

COURSE CONTENT:
${course_content || content || ''}

KEY TOPICS:
${extractKeyTopics(course_content || content || '')}

CORE CONCEPTS:
${extractCoreConcepts(course_content || content || '')}

LITERATURE AND RESOURCES:
${literature || ''}
`.trim();

    return cleanText(structuredText);
};

// Function to extract key topics from text
const extractKeyTopics = (text) => {
    if (!text) return '';

    // Look for common topic indicators
    const topicIndicators = [
        /[•\-*]\s*([^.\n]+)/g,     // Bullet points
        /\d+\.\s+([^.\n]+)/g,      // Numbered lists
        /tema:?\s*([^.\n]+)/gi,    // "Tema" followed by content
        /topic:?\s*([^.\n]+)/gi,   // "Topic" followed by content
        /module:?\s*([^.\n]+)/gi   // "Module" followed by content
    ];

    let topics = new Set(); // Use Set to avoid duplicates
    topicIndicators.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[1] && match[1].trim().length > 3) {
                topics.add(cleanText(match[1]));
            }
        }
    });

    return Array.from(topics).join('\n');
};

// Update generateEmbedding to use the new preparation
export const generateEmbedding = async (text, translateFirst = false) => {
    try {
        // Prepare the course text
        const preparedText = prepareCourseText({
            name: typeof text === 'string' ? text : text.name,
            content: typeof text === 'string' ? text : text.content,
            literature: typeof text === 'string' ? '' : text.literature,
            ...text
        });

        let norwegianText = preparedText;
        let englishText = preparedText;
        const isEnglish = isEnglishText(preparedText);

        // Generate both language versions
        if (isEnglish) {
            norwegianText = await translateText(preparedText, 'nb');
        } else {
            englishText = await translateText(preparedText, 'en');
        }

        // Generate embeddings with enhanced context
        const [norwegianEmbedding, englishEmbedding] = await Promise.all([
            openai.embeddings.create({
                model: "text-embedding-3-large",
                input: norwegianText,
                encoding_format: "float",
                dimensions: 2000
            }),
            openai.embeddings.create({
                model: "text-embedding-3-large",
                input: englishText,
                encoding_format: "float",
                dimensions: 2000
            })
        ]);

        return {
            norwegian: norwegianEmbedding.data[0].embedding,
            english: englishEmbedding.data[0].embedding,
            isEnglishInput: isEnglish,
            preparedText // Include the prepared text for reference
        };
    } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
    }
};

// Legg til export for generateOverlapExplanation
export const generateOverlapExplanation = async (courseA, courseB, similarityScore) => {
    const cacheKey = `${courseA.name}-${courseB.kurskode}`;

    if (analysisCache.has(cacheKey)) {
        return analysisCache.get(cacheKey);
    }

    const isSameCourse = courseA.name === courseB.kursnavn ||
        (courseA.code && courseA.code === courseB.kurskode);

    const prompt = `
Du er en akademisk rådgiver som skal forklare overlapp mellom to kurs. 
${isSameCourse ? 'Dette er samme kurs som sammenlignes med seg selv.' : ''}
Generer en strukturert forklaring på norsk (maks 250 ord) som sammenligner disse kursene:

Kurs A: ${courseA.name}
${courseA.content}
${courseA.literature ? `Pensum: ${courseA.literature}` : ''}

Kurs B: ${courseB.kursnavn} (${courseB.kurskode})
${courseB.description || courseB.course_content || 'Ingen beskrivelse tilgjengelig'}
${courseB.pensum ? `Pensum: ${courseB.pensum}` : ''}

Similaritet: ${similarityScore}%

Formater svaret slik:

### KURSSAMMENLIGNING
▸ ${isSameCourse ? 'Dette er samme kurs sammenlignet med seg selv' : 'Kort introduksjon av begge kursene'}
▸ Overordnet vurdering av overlapp (${similarityScore}% likhet)

### HOVEDFOKUS
• Sentrale temaer og konsepter${isSameCourse ? ' i kurset' : ' som overlapper'}
${!isSameCourse ? `• Unike aspekter i ${courseA.name}
• Unike aspekter i ${courseB.kursnavn}` : ''}

### LÆRINGSUTBYTTE
• Sentrale kompetanser${isSameCourse ? ' som kurset gir' : ' som overlapper'}:
  - [Liste med kompetanser]
${!isSameCourse ? `• Unike kompetanser i ${courseA.name}:
  - [Liste med unike ferdigheter]
• Unike kompetanser i ${courseB.kursnavn}:
  - [Liste med unike ferdigheter]` : ''}

### ANBEFALING
▸ ${isSameCourse ? 'Dette er samme kurs, så det er ikke relevant å ta det flere ganger' : 'Er det hensiktsmessig å ta begge kursene?'}
${!isSameCourse ? `▸ Anbefalt rekkefølge (hvis relevant)
▸ Målgruppe og tilpasning` : ''}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",  // Nyeste og billigste versjonen
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000
        });

        await logApiCost(
            'explanations',
            'gpt-3.5-turbo-0125',
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        const explanation = response.choices[0].message.content.trim();
        analysisCache.set(cacheKey, explanation);
        return explanation;
    } catch (error) {
        console.error('Error generating overlap explanation:', error);
        throw error;
    }
};