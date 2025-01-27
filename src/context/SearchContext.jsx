import React, { createContext, useContext, useState } from 'react';

const defaultColumns = [
    { id: 'col-kurskode', label: 'Kurs', enabled: true, required: true },
    { id: 'col-similarity', label: 'Likhet', enabled: true, required: true },
    { id: 'col-credits', label: 'Studiepoeng', enabled: true },
    { id: 'col-level', label: 'Studienivå', enabled: true },
    { id: 'col-språk', label: 'Språk', enabled: true },
    { id: 'col-semester', label: 'Semester', enabled: true },
    { id: 'col-portfolio', label: 'Portfolio', enabled: false },
    { id: 'col-område', label: 'Område', enabled: false },
    { id: 'col-academic-coordinator', label: 'Koordinator', enabled: false },
    { id: 'col-institutt', label: 'Institutt', enabled: false },
    { id: 'col-ai', label: 'AI Analyse', enabled: true }
];

const defaultFilters = {
    studyLevel: ['Bachelor', 'Master', 'PhD'],
    language: ['Norsk', 'Engelsk'],
    credits: ['5', '7.5', '10', '15', '20', '30'],
    semester: ['Høst', 'Vår', 'Høst og vår'],
    portfolio: ['Obligatorisk', 'Valgfri'],
    område: ['Informatikk', 'Matematikk', 'Fysikk', 'Kjemi'],
    academic_coordinator: [],
    institutt: []
};

const SearchContext = createContext();

export const SearchProvider = ({ children }) => {
    const [searchState, setSearchState] = useState({
        formData: {
            courseName: '',
            courseDescription: '',
            courseLiterature: ''
        },
        results: null,
        showForm: true,
        filters: {
            searchTerm: '',
            similarityRange: [0, 100],
            studyLevel: 'all',
            language: 'all',
            credits: 'all',
            semester: 'all',
            portfolio: 'all',
            område: 'all',
            academic_coordinator: 'all',
            kursnavn: '',
            institutt: 'all'
        },
        availableColumns: defaultColumns,
        availableFilters: defaultFilters
    });

    const updateSearchState = (newState) => {
        setSearchState(prev => ({
            ...prev,
            ...newState
        }));
    };

    return (
        <SearchContext.Provider value={{ searchState, updateSearchState }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
};

export { defaultColumns, defaultFilters }; 