import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    IconButton,
    CircularProgress,
    Alert,
    Fade,
    Chip,
    Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { getSearchHistory, deleteSearch } from '../services/supabase';
import styled from '@emotion/styled';

const StyledCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    borderRadius: '12px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
    }
}));

const SearchHistory = ({ onRestoreSearch }) => {
    const [searches, setSearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadSearchHistory = async () => {
        try {
            const data = await getSearchHistory();
            // Filter out any malformed search entries
            const validSearches = (data || []).filter(search =>
                search &&
                search.search_input &&
                typeof search.search_input === 'object'
            );
            setSearches(validSearches);
        } catch (err) {
            setError('Kunne ikke laste søkehistorikk');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSearchHistory();
    }, []);

    const handleDelete = async (searchId) => {
        try {
            await deleteSearch(searchId);
            setSearches(searches.filter(search => search.id !== searchId));
        } catch (err) {
            setError('Kunne ikke slette søket');
            console.error(err);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        // Hvis søket er fra i dag
        if (date.toDateString() === now.toDateString()) {
            return `I dag ${date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        }

        // Hvis søket er fra i går
        if (date.toDateString() === yesterday.toDateString()) {
            return `I går ${date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        }

        // For alle andre datoer
        return date.toLocaleString('nb-NO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (searches.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="h6" color="text.secondary">
                    Ingen søk i historikken ennå
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Dine siste 5 søk vil vises her
                </Typography>
            </Box>
        );
    }

    return (
        <Fade in={true}>
            <Box>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                    Mine siste søk
                </Typography>
                {searches.map((search) => (
                    <StyledCard key={search.id}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        {search.search_input?.courseName || 'Untitled Search'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Søkt {formatDate(search.created_at)}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                        <Chip
                                            label={`${search.results?.length || 0} treff`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        {search.results?.[0]?.similarity && (
                                            <Chip
                                                label={`Beste treff: ${Math.round(search.results[0].similarity)}%`}
                                                size="small"
                                                color="success"
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                    {search.search_input?.courseDescription && (
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                mb: 2
                                            }}
                                        >
                                            {search.search_input.courseDescription}
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        startIcon={<RestoreIcon />}
                                        variant="contained"
                                        onClick={() => onRestoreSearch(search)}
                                        size="small"
                                    >
                                        Gjenopprett
                                    </Button>
                                    <IconButton
                                        onClick={() => handleDelete(search.id)}
                                        size="small"
                                        color="error"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                            {search.results?.[0] && (
                                <Box sx={{
                                    mt: 2,
                                    p: 2,
                                    bgcolor: 'background.default',
                                    borderRadius: 1
                                }}>
                                    <Typography variant="subtitle2" color="primary">
                                        Beste treff:
                                    </Typography>
                                    <Typography variant="body2">
                                        {search.results[0].kurskode} - {search.results[0].kursnavn}
                                    </Typography>
                                </Box>
                            )}
                        </CardContent>
                    </StyledCard>
                ))}
            </Box>
        </Fade>
    );
};

export default SearchHistory; 