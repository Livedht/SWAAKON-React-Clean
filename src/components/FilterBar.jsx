import React, { useState } from 'react';
import {
    Box,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Slider,
    Typography,
    Chip,
    IconButton,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

const FilterBar = ({ filters, setFilters, availableFilters }) => {
    const {
        searchTerm,
        similarityRange,
        studyLevel,
        language,
        credits
    } = filters;

    const [sortBy, setSortBy] = useState('similarity');
    const [sortOrder, setSortOrder] = useState('desc');

    const handleClearFilters = () => {
        setFilters({
            searchTerm: '',
            similarityRange: [0, 100],
            studyLevel: 'all',
            language: 'all',
            credits: 'all'
        });
    };

    return (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Filtrer kurs</Typography>
                <IconButton onClick={handleClearFilters} size="small">
                    <ClearIcon />
                </IconButton>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    label="Søk"
                    value={searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    size="small"
                    sx={{ minWidth: 200 }}
                />

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Studienivå</InputLabel>
                    <Select
                        value={studyLevel}
                        label="Studienivå"
                        onChange={(e) => setFilters(prev => ({ ...prev, studyLevel: e.target.value }))}
                    >
                        <MenuItem value="all">Alle nivåer</MenuItem>
                        {availableFilters.studyLevels.map(level => (
                            <MenuItem key={level} value={level}>{level}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Språk</InputLabel>
                    <Select
                        value={language}
                        label="Språk"
                        onChange={(e) => setFilters(prev => ({ ...prev, language: e.target.value }))}
                    >
                        <MenuItem value="all">Alle språk</MenuItem>
                        {availableFilters.languages.map(lang => (
                            <MenuItem key={lang} value={lang}>
                                {lang === 'nb' ? 'Norsk' : 'Engelsk'}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Studiepoeng</InputLabel>
                    <Select
                        value={credits}
                        label="Studiepoeng"
                        onChange={(e) => setFilters(prev => ({ ...prev, credits: e.target.value }))}
                    >
                        <MenuItem value="all">Alle</MenuItem>
                        {availableFilters.creditOptions.map(credit => (
                            <MenuItem key={credit} value={credit}>{credit} stp</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ width: 200, px: 2 }}>
                    <Typography gutterBottom>Similarity Score</Typography>
                    <Slider
                        value={similarityRange}
                        onChange={(e, newValue) => setFilters(prev => ({ ...prev, similarityRange: newValue }))}
                        valueLabelDisplay="auto"
                        min={0}
                        max={100}
                    />
                </Box>

                <FormControl sx={{ minWidth: 120, ml: 2 }}>
                    <InputLabel>Sorter etter</InputLabel>
                    <Select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <MenuItem value="similarity">Likhet</MenuItem>
                        <MenuItem value="credits">Studiepoeng</MenuItem>
                        <MenuItem value="name">Navn</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(filters).map(([key, value]) => {
                    if (value && value !== 'all' && key !== 'similarityRange') {
                        return (
                            <Chip
                                key={key}
                                label={`${key}: ${value}`}
                                onDelete={() => setFilters(prev => ({ ...prev, [key]: 'all' }))}
                                size="small"
                            />
                        );
                    }
                    return null;
                })}
            </Box>
        </Box>
    );
};

export default FilterBar; 