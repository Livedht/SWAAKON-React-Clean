import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import natural from 'natural';
import { pipeline } from '@xenova/transformers';
import config from '../config';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
    });
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Custom stopwords (hardcoded for browser environment)
const customStopwords = new Set([
    'og', 'i', 'jeg', 'det', 'at', 'en', 'den', 'til', 'er', 'som',
    'på', 'de', 'med', 'han', 'av', 'ikke', 'der', 'så', 'var', 'meg',
    'seg', 'men', 'ett', 'har', 'om', 'vi', 'min', 'mitt', 'ha', 'hadde',
    'hun', 'nå', 'over', 'da', 'ved', 'fra', 'du', 'ut', 'sin', 'dem',
    'oss', 'opp', 'man', 'kan', 'hans', 'hvor', 'eller', 'hva', 'skal', 'selv',
    'sjøl', 'her', 'alle', 'vil', 'bli', 'ble', 'blitt', 'kunne', 'inn', 'når',
    'være', 'kom', 'noen', 'noe', 'ville', 'dere', 'som', 'deres', 'kun', 'ja',
    'etter', 'ned', 'skulle', 'denne', 'for', 'deg', 'si', 'sine', 'sitt', 'mot',
    'å', 'meget', 'hvorfor', 'dette', 'disse', 'uten', 'hvordan', 'ingen', 'din',
    'ditt', 'blir', 'samme', 'hvilken', 'hvilke', 'sånn', 'inni', 'mellom', 'vår',
    'hver', 'hvem', 'vors', 'hvis', 'både', 'bare', 'enn', 'fordi', 'før', 'mange',
    'også', 'slik', 'vært', 'være', 'båe', 'begge', 'siden', 'dykk', 'dykkar', 'dei',
    'deira', 'deires', 'deim', 'di', 'då', 'eg', 'ein', 'eit', 'eitt', 'elles',
    'honom', 'hjå', 'ho', 'hoe', 'henne', 'hennar', 'hennes', 'hoss', 'hossen', 'ikkje',
    'ingi', 'inkje', 'korleis', 'korso', 'kva', 'kvar', 'kvarhelst', 'kven', 'kvi',
    'kvifor', 'me', 'medan', 'mi', 'mine', 'mykje', 'no', 'nokon', 'noka', 'nokor',
    'noko', 'nokre', 'si', 'sia', 'sidan', 'so', 'somt', 'somme', 'um', 'upp', 'vere',
    'vore', 'verte', 'vort', 'varte', 'vart'
]);

// Initialize natural's tokenizer
const tokenizer = new natural.WordTokenizer();

// Function to remove stopwords and clean text
function removeStopwords(text) {
    if (!text) return '';

    // Normalize Norwegian characters and convert to lowercase
    const normalizedText = text.toLowerCase()
        .normalize('NFKC')  // Normalize Unicode characters
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"');

    // Split on whitespace while preserving Norwegian characters
    const tokens = normalizedText.split(/\s+/);

    // Remove stopwords and keep only valid characters (including Norwegian letters)
    return tokens
        .filter(token => !customStopwords.has(token))
        .filter(token => /^[a-zæøåA-ZÆØÅ\-]+$/i.test(token))
        .join(' ');
}

// Function to extract keywords using RAKE-like algorithm
function extractKeywords(text) {
    if (!text) return [];

    // Clean text while preserving Norwegian characters
    const cleanText = text.toLowerCase()
        .normalize('NFKC')  // Normalize Unicode characters
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/[^a-zæøåA-ZÆØÅ\s\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const words = removeStopwords(cleanText).split(/\s+/);

    // Count word frequencies
    const wordFreq = {};
    words.forEach(word => {
        if (word.length > 1) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });

    return Object.entries(wordFreq)
        .filter(([_, freq]) => freq > 1)
        .sort(([_, freqA], [__, freqB]) => freqB - freqA)
        .map(([word]) => word)
        .slice(0, 10);
}

// Function to prepare course text for embedding
export function prepareCourseText(course) {
    const sections = [];

    // Keep course identifiers separate
    if (course.kursnavn) sections.push(`COURSE NAME: ${course.kursnavn}`);
    if (course.kurskode) sections.push(`COURSE CODE: ${course.kurskode}`);

    // Combine all learning outcomes and content
    const combinedText = [
        course.learning_outcome_knowledge,
        course.learning_outcome_skills,
        course.learning_outcome_general_competence,
        course.course_content
    ].filter(Boolean).join(' ');

    // Clean the combined text while preserving Norwegian characters
    const cleanedText = removeStopwords(combinedText);
    if (cleanedText) {
        sections.push('COURSE CONTENT AND LEARNING OUTCOMES:');
        sections.push(cleanedText);
    }

    // Extract keywords from the cleaned combined text
    const keywords = extractKeywords(cleanedText);
    if (keywords.length > 0) {
        sections.push('KEY CONCEPTS:');
        sections.push(keywords.join(' '));
    }

    return sections.join('\n\n');
}

// Funksjon for å generere embedding med HuggingFace
export const generateHFEmbedding = async (text) => {
    try {
        // Først prøv lokal inferens
        try {
            const response = await fetch(config.API.HUGGINGFACE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const embedding = await response.json();
            return embedding;

        } catch (error) {
            console.log('Local inference failed:', error);
            
            // Hvis lokal inferens feiler, prøv direkte mot HuggingFace API
            const huggingfaceKey = process.env.REACT_APP_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
            
            const result = await fetch(
                "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/distiluse-base-multilingual-cased-v2",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${huggingfaceKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        inputs: [text],
                        options: {
                            wait_for_model: true,
                            use_cache: true
                        }
                    })
                }
            );

            if (!result.ok) {
                throw new Error(`HuggingFace API error! status: ${result.status}`);
            }

            const data = await result.json();
            return Array.isArray(data) ? data[0] : data;
        }
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
};

// Calculate cosine similarity between two vectors
export function calculateCosineSimilarity(vecA, vecB) {
    console.log('=== Starting similarity calculation ===');
    console.log('Vector dimensions:', { vecALength: vecA?.length, vecBLength: vecB?.length });

    try {
        if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) {
            console.error('Invalid vectors:', { vecA, vecB });
            throw new Error('Invalid vectors provided');
        }

        if (vecA.length !== vecB.length) {
            console.error('Vector dimension mismatch:', { dimA: vecA.length, dimB: vecB.length });
            throw new Error('Vector dimensions do not match');
        }

        // Check if vectors are identical
        const isIdentical = vecA.every((val, idx) => Math.abs(val - vecB[idx]) < 1e-10);
        if (isIdentical) {
            console.log('Vectors are identical!');
            return 1;
        }

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        if (magnitudeA === 0 || magnitudeB === 0) {
            console.error('Zero magnitude vector detected:', { magnitudeA, magnitudeB });
            return 0;
        }

        const similarity = dotProduct / (magnitudeA * magnitudeB);
        console.log('Raw similarity score:', similarity);

        // Only apply non-linear scaling if not an exact match
        const scaledSimilarity = isIdentical ? 1 : Math.pow(similarity, 1.5);
        console.log('Scaled similarity score:', scaledSimilarity);

        return scaledSimilarity;

    } catch (error) {
        console.error('Error in cosineSimilarity calculation:', error);
        return 0;
    }
}

// Calculate course similarity with regional comparisons
export function calculateCourseSimilarity(vecA, vecB) {
    const similarity = calculateCosineSimilarity(vecA, vecB);

    // If it's an exact match from cosine similarity, return 100
    if (similarity === 1) {
        return 100;
    }

    // Apply non-linear scaling to emphasize high similarities
    let score = similarity * 100;

    if (score >= 70) {
        // Boost high similarities
        score = Math.min(99.9, score * 1.2); // Cap at 99.9 to reserve 100 for exact matches
    } else if (score >= 40) {
        // Gentle boost for moderate similarities
        score = score * 1.1;
    } else {
        // Reduce noise from low similarities
        score = score * 0.8;
    }

    return Math.round(score * 10) / 10; // Round to 1 decimal place
}

// Find similar courses from a list
export const findSimilarCourses = async (newCourseData, storedCourses) => {
    console.log(`Processing ${storedCourses.length} courses for similarity`);

    if (!newCourseData?.embedding || !Array.isArray(newCourseData.embedding)) {
        console.error('Invalid embedding format:', newCourseData);
        throw new Error('No valid embedding provided for the new course');
    }

    console.log('New course embedding dimensions:', newCourseData.embedding.length);
    console.log('Sample of new course embedding:', newCourseData.embedding.slice(0, 5));

    try {
        const similarities = storedCourses
            .map(course => {
                // Get the embedding from the course
                const courseEmbedding = course.embedding;

                if (!courseEmbedding) {
                    console.log(`Missing embedding for course: ${course.kurskode}`);
                    return null;
                }

                if (!Array.isArray(courseEmbedding) || courseEmbedding.length !== 512) {
                    console.log(`Invalid embedding for course ${course.kurskode}: length=${courseEmbedding?.length}`);
                    return null;
                }

                // Calculate similarity
                const similarity = calculateCourseSimilarity(
                    newCourseData.embedding,
                    courseEmbedding
                );

                console.log(`Similarity for ${course.kurskode}: ${similarity}%`);

                return {
                    kurskode: course.kurskode,
                    kursnavn: course.kursnavn,
                    credits: course.credits,
                    level_of_study: course.level_of_study,
                    språk: course.språk,
                    semester: course.semester,
                    portfolio: course.portfolio,
                    ansvarlig_institutt: course.ansvarlig_institutt,
                    ansvarlig_område: course.ansvarlig_område,
                    academic_coordinator: course.academic_coordinator,
                    course_content: course.course_content,
                    learning_outcome_knowledge: course.learning_outcome_knowledge,
                    learning_outcome_skills: course.learning_outcome_skills,
                    learning_outcome_general_competence: course.learning_outcome_general_competence,
                    similarity
                };
            })
            .filter(result => result !== null)  // Only filter out null results
            .sort((a, b) => b.similarity - a.similarity);  // Still sort by similarity

        if (similarities.length === 0) {
            console.log('No courses found');
            throw new Error('No courses found to compare against. Please try again later.');
        }

        console.log(`Found ${similarities.length} courses`);
        console.log('Top 3 similarities:', similarities.slice(0, 3).map(s => `${s.kurskode}: ${s.similarity}%`));
        return similarities;
    } catch (error) {
        console.error('Error in findSimilarCourses:', error);
        throw error;
    }
}

// Helper function to format credits
export const formatCredits = (credits, format = 'ECTS') => {
    if (!credits) return '';

    // Convert to string first to handle both string and number inputs
    const creditStr = credits.toString();

    // Handle special cases
    let formattedValue = creditStr;
    if (creditStr === '75') formattedValue = '7.5';
    if (creditStr === '25') formattedValue = '2.5';

    // For other cases, parse and format normally
    const numCredits = parseFloat(creditStr);
    if (isNaN(numCredits)) return creditStr;

    // Add the unit
    return `${formattedValue} ${format}`;
};

export function generateExcelReport(enrichedCourses) {
    // Logging for debugging
    console.log('Excel Report Debug:', {
        sample: enrichedCourses[0],
        hasInstitutt: !!enrichedCourses[0]?.ansvarlig_institutt,
        hasOmråde: !!enrichedCourses[0]?.ansvarlig_område,
        totalCourses: enrichedCourses.length
    });

    const wb = XLSX.utils.book_new();

    // Sort courses by overlap score
    const sortedCourses = enrichedCourses.sort((a, b) => b['Overlap Score (%)'] - a['Overlap Score (%)']);

    // Prepare data for Excel
    const data = sortedCourses.map(course => {
        const courseCode = course['Existing Course Code'];
        const addInfo = course;

        return {
            'School': addInfo.school || '',
            'Course Code': courseCode,
            'Course Name': addInfo.kursnavn,
            'Credits': formatCredits(addInfo.credits, 'ECTS') || '',
            'Overlap Score (%)': course['Overlap Score (%)'],
            'Level': addInfo.level_of_study || '',
            'Language': addInfo.språk || '',
            'Semester': addInfo.semester || '',
            'Portfolio': addInfo.portfolio || '',
            'Department': addInfo.ansvarlig_område || '',
            'Institute': addInfo.ansvarlig_institutt || '',
            'Academic Coordinator': addInfo.academic_coordinator || '',
            
            // Nye kolonner for læringsutbytte
            'Learning Outcomes - Knowledge': addInfo.learning_outcome_knowledge || '',
            'Learning Outcomes - Skills': addInfo.learning_outcome_skills || '',
            'Learning Outcomes - General Competence': addInfo.learning_outcome_general_competence || '',
            
            // Kursinnhold og analyse
            'Course Content': addInfo.course_content || '',
            'AI Analysis': course.Explanation || '',
            'Keywords': course.Keywords || '',
            
            // Lenker
            'Link (NO)': addInfo.link_nb || '',
            'Link (EN)': addInfo.link_en || '',
            
            // Ekstra metadata
            'Last Updated': addInfo.last_updated || '',
            'Study Points': formatCredits(addInfo.studiepoeng || addInfo.credits, 'stp') || '',
            'Teaching Language': addInfo.undv_språk || addInfo.språk || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);

    // Forbedret formatering
    const colWidths = {
        'School': 10,
        'Course Code': 12,
        'Course Name': 40,
        'Credits': 8,
        'Overlap Score (%)': 12,
        'Level': 15,
        'Language': 10,
        'Semester': 12,
        'Portfolio': 15,
        'Department': 25,
        'Institute': 25,
        'Academic Coordinator': 25,
        'Learning Outcomes - Knowledge': 50,
        'Learning Outcomes - Skills': 50,
        'Learning Outcomes - General Competence': 50,
        'Course Content': 50,
        'AI Analysis': 50,
        'Keywords': 30,
        'Link (NO)': 30,
        'Link (EN)': 30,
        'Last Updated': 15,
        'Study Points': 12,
        'Teaching Language': 15
    };

    // Sett kolonnebredder
    ws['!cols'] = Object.entries(colWidths).map(([_, width]) => ({
        wch: width,
        alignment: { wrapText: true }
    }));

    // Legg til arket i arbeidsboken
    XLSX.utils.book_append_sheet(wb, ws, "Overlap Results");

    // Generer Excel-filen
    const excelBuffer = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array',
        cellStyles: true
    });

    return new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

export function generatePDFReport(overlappingCourses, additionalInfo) {
    const doc = new jsPDF('l', 'pt', 'a4');
    const sortedCourses = overlappingCourses
        .sort((a, b) => b['Overlap Score (%)'] - a['Overlap Score (%)'])
        .slice(0, 15);

    // Add title
    doc.setFontSize(16);
    doc.text('Top 15 Overlapping Courses', 40, 40);

    // Prepare table data
    const tableData = sortedCourses.map(course => {
        const courseCode = course['Existing Course Code'];
        const addInfo = additionalInfo.find(info => info.kurskode === courseCode) || {};

        return [
            addInfo.school || '',
            courseCode,
            course['Existing Course Name'],
            addInfo.credits || '',
            `${course['Overlap Score (%)'].toFixed(2)}%`,
            addInfo.level_of_study || ''
        ];
    });

    // Add main table
    doc.autoTable({
        head: [['School', 'Code', 'Name', 'Credits', 'Overlap %', 'Level']],
        body: tableData,
        startY: 60,
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 70 },
            2: { cellWidth: 200 },
            3: { cellWidth: 50 },
            4: { cellWidth: 60 },
            5: { cellWidth: 70 }
        }
    });

    // Add explanations
    let yPos = doc.lastAutoTable.finalY + 30;
    sortedCourses.forEach(course => {
        if (course.Explanation) {
            if (yPos > 500) {
                doc.addPage();
                yPos = 40;
            }

            doc.setFontSize(10);
            doc.text(`${course['Existing Course Name']} (${course['Existing Course Code']})`, 40, yPos);

            doc.setFontSize(8);
            const splitText = doc.splitTextToSize(course.Explanation, 750);
            doc.text(splitText, 40, yPos + 15);

            yPos += 20 + (splitText.length * 10);
        }
    });

    return doc.output('blob');
}

export async function testHuggingFaceConnection() {
    try {
        const testText = "Dette er en test av HuggingFace API tilkobling.";
        console.log('Starting HuggingFace connection test...');
        console.log('API Key present:', !!process.env.REACT_APP_HUGGINGFACE_API_KEY);
        console.log('Test text:', testText);

        const embedding = await generateHFEmbedding(testText);

        if (!embedding) {
            throw new Error('No embedding returned from API');
        }

        console.log('Connection successful!');
        console.log('Embedding dimensions:', embedding.length);
        console.log('First 5 values:', embedding.slice(0, 5));
        console.log('Full embedding type:', typeof embedding);
        console.log('Is array?', Array.isArray(embedding));

        return {
            success: true,
            dimensions: embedding.length,
            sample: embedding.slice(0, 5)
        };
    } catch (error) {
        console.error('HuggingFace connection test failed:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return {
            success: false,
            error: error.message
        };
    }
}

export const generateCourseAnalysis = async (inputCourse, matchedCourse, similarity) => {
    try {
        // Format the input course text
        const inputCourseText = [
            inputCourse.name,
            inputCourse.content
        ].filter(Boolean).join('\n\n');

        // Format the matched course text from the database
        const matchedCourseText = [
            `Kunnskap (Knowledge):`,
            matchedCourse.learning_outcome_knowledge,
            `\nFerdigheter (Skills):`,
            matchedCourse.learning_outcome_skills,
            `\nGenerell kompetanse (General Competence):`,
            matchedCourse.learning_outcome_general_competence,
            `\nKursinnhold (Course Content):`,
            matchedCourse.course_content
        ].filter(Boolean).join('\n');

        const prompt = `
            Analyser likheten mellom disse to kursene:

            Kurs 1: ${inputCourse.name}
            Beskrivelse:
            ${inputCourseText}

            Kurs 2: ${matchedCourse.kurskode} - ${matchedCourse.kursnavn}
            ${matchedCourseText}

            Nivå: ${matchedCourse.level_of_study || 'Ikke spesifisert'}
            Studiepoeng: ${matchedCourse.credits || 'Ikke spesifisert'}
            Språk: ${matchedCourse.språk || 'Ikke spesifisert'}

            Likhetsscore: ${similarity}%

            Vennligst gi en strukturert analyse på norsk:

            ### KURSSAMMENLIGNING
            ▸ Kort introduksjon av begge kursene
            ▸ Overordnet vurdering av overlapp (${similarity}% likhet)

            ### HOVEDFOKUS
            • Sentrale temaer og konsepter som overlapper
            • Unike aspekter i ${inputCourse.name}
            • Unike aspekter i ${matchedCourse.kursnavn}

            ### LÆRINGSUTBYTTE
            • Sentrale kompetanser som overlapper:
              - [Liste med kompetanser]
            • Unike kompetanser i ${inputCourse.name}:
              - [Liste med unike ferdigheter]
            • Unike kompetanser i ${matchedCourse.kursnavn}:
              - [Liste med unike ferdigheter]

            ### ANBEFALING
            ▸ Er det hensiktsmessig å ta begge kursene?
            ▸ Anbefalt rekkefølge (hvis relevant)
            ▸ Målgruppe og tilpasning`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4-turbo-preview",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate analysis');
        }

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        console.error('Error generating course analysis:', error);
        throw error;
    }
}; 