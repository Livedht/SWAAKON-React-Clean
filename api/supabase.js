import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Example endpoint - modify based on your needs
        const { action, data } = request.body;

        switch (action) {
            case 'fetchEmbeddings':
                const { data: embeddings } = await supabase
                    .from('embeddings')
                    .select('*');
                return response.status(200).json(embeddings);

            // Add more cases as needed
            default:
                return response.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
} 