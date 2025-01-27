export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text } = request.body;
        console.log('Received text:', text.slice(0, 100) + '...'); // Log truncated input

        // Legg til sjekk for begge varianter av miljøvariabelen
        const huggingfaceKey = process.env.REACT_APP_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;

        console.log('HuggingFace Config Debug:', {
            hasKey: !!huggingfaceKey
        });

        // Function to make the API call with retries and longer timeout
        const callHuggingFaceAPI = async (retries = 5) => {  // Increased retries
            for (let i = 0; i < retries; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);  // 30 second timeout

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
                            }),
                            signal: controller.signal
                        }
                    );

                    clearTimeout(timeoutId);

                    if (result.status === 503) {
                        console.log(`Model loading, attempt ${i + 1} of ${retries}`);
                        await new Promise(resolve => setTimeout(resolve, 15000)); // Increased wait time to 15 seconds
                        continue;
                    }

                    if (!result.ok) {
                        const errorText = await result.text();
                        console.error('API Error:', {
                            status: result.status,
                            text: errorText
                        });
                        throw new Error(`HTTP error! status: ${result.status}`);
                    }

                    const data = await result.json();
                    return data;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('Request timed out, retrying...');
                    } else {
                        console.error(`Attempt ${i + 1} failed:`, error);
                    }

                    if (i === retries - 1) throw error;
                    await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1))); // Exponential backoff
                }
            }
        };

        const data = await callHuggingFaceAPI();

        console.log('HuggingFace API response:', {
            isArray: Array.isArray(data),
            length: Array.isArray(data) ? data.length : 'not an array',
            sample: Array.isArray(data) ? data[0]?.slice(0, 3) : 'no sample'
        });

        if (Array.isArray(data) && data.length > 0) {
            return response.status(200).json(data[0]);
        } else {
            console.error('Unexpected API response format:', data);
            return response.status(500).json({
                error: 'Invalid response format from HuggingFace API',
                details: data
            });
        }
    } catch (error) {
        console.error('HuggingFace API error:', error);
        return response.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: error.toString()
        });
    }
} 