import React, { useState } from 'react';
import {
    Container,
    TextField,
    Button,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Box
} from '@mui/material';
import { generateHFEmbedding, calculateCosineSimilarity } from '../services/similarity';
import { supabase } from '../services/supabase';

const GlobalCourseSearch = () => {
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);

    const handleSearch = async () => {
        try {
            setLoading(true);
            setError(null);

            // Generate embedding for search text
            const embedding = await generateHFEmbedding(searchText);

            // Query Supabase for similar courses
            const { data, error: dbError } = await supabase
                .from('courses_previous')
                .select('*')
                .not('embedding', 'is', null);

            if (dbError) throw dbError;

            // Calculate similarities
            const similarities = data
                .map(course => {
                    const courseEmbedding = course.embedding;
                    if (!courseEmbedding) return null;

                    // Calculate cosine similarity
                    const similarity = calculateCosineSimilarity(embedding, courseEmbedding);
                    return {
                        ...course,
                        similarity: Math.round(similarity * 1000) / 10 // Convert to percentage with 1 decimal
                    };
                })
                .filter(result => result !== null)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 50); // Show top 50 results

            setResults(similarities);
        } catch (err) {
            console.error('Search error:', err);
            setError('An error occurred while searching. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Global Course Search
            </Typography>
            <Typography variant="body1" paragraph>
                Search for similar courses across Norwegian educational institutions.
            </Typography>

            <Paper sx={{ p: 3, mb: 4 }}>
                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    label="Enter course description"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    sx={{ mb: 2 }}
                />
                <Button
                    variant="contained"
                    onClick={handleSearch}
                    disabled={loading || !searchText.trim()}
                >
                    {loading ? <CircularProgress size={24} /> : 'Search'}
                </Button>
            </Paper>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {error}
                </Typography>
            )}

            {results.length > 0 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>School</TableCell>
                                <TableCell>Course Code</TableCell>
                                <TableCell>Course Name</TableCell>
                                <TableCell>Similarity</TableCell>
                                <TableCell>Credits</TableCell>
                                <TableCell>Level</TableCell>
                                <TableCell>Links</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {results.map((course) => (
                                <TableRow key={`${course.school}-${course.kurskode}`}>
                                    <TableCell>{course.school}</TableCell>
                                    <TableCell>{course.kurskode}</TableCell>
                                    <TableCell>{course.kursnavn}</TableCell>
                                    <TableCell>{course.similarity}%</TableCell>
                                    <TableCell>{course.credits}</TableCell>
                                    <TableCell>{course.level_of_study}</TableCell>
                                    <TableCell>
                                        {course.link_nb && (
                                            <Button
                                                href={course.link_nb}
                                                target="_blank"
                                                size="small"
                                            >
                                                NO
                                            </Button>
                                        )}
                                        {course.link_en && (
                                            <Button
                                                href={course.link_en}
                                                target="_blank"
                                                size="small"
                                                sx={{ ml: 1 }}
                                            >
                                                EN
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default GlobalCourseSearch; 