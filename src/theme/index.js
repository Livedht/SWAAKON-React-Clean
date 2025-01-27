import { createTheme } from '@mui/material/styles';

// Default theme colors
const defaultColors = {
    primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
        contrastText: '#fff'
    },
    secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
        contrastText: '#fff'
    }
};

// Dark theme colors
const darkColors = {
    primary: {
        main: '#90caf9',
        light: '#e3f2fd',
        dark: '#42a5f5',
        contrastText: '#000'
    },
    secondary: {
        main: '#ce93d8',
        light: '#f3e5f5',
        dark: '#ab47bc',
        contrastText: '#000'
    },
    background: {
        default: '#121212',
        paper: '#1e1e1e'
    }
};

// Excel-inspirerte farger
const excelColors = {
    primary: {
        main: '#217346', // Excel grønn
        light: '#2E8B57',
        dark: '#1E6B3E',
        contrastText: '#fff'
    },
    secondary: {
        main: '#217346',
        light: '#4CAF50',
        dark: '#1B5E20',
        contrastText: '#fff'
    },
    background: {
        default: '#ffffff',
        paper: '#f5f5f5',
        header: '#E6E6E6', // Excel header grå
        alternateRow: '#F8F9FA', // Excel alternerende rad
        selected: '#CCE8FF', // Excel markert celle
        hover: '#EDF3FA' // Excel hover effekt
    },
    border: '#D4D4D4', // Excel celle-border
    text: {
        primary: '#212121',
        secondary: '#666666'
    }
};

export const defaultTheme = createTheme({
    palette: {
        mode: 'light',
        ...defaultColors
    }
});

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        ...darkColors
    }
});

export const excelTheme = createTheme({
    palette: {
        mode: 'light',
        ...excelColors
    },
    components: {
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: excelColors.border,
                    padding: '6px 8px',
                    fontSize: '0.875rem',
                    '&:hover': {
                        backgroundColor: excelColors.background.hover
                    }
                },
                head: {
                    backgroundColor: excelColors.background.header,
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                }
            }
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:nth-of-type(even)': {
                        backgroundColor: excelColors.background.alternateRow
                    },
                    '&.Mui-selected': {
                        backgroundColor: excelColors.background.selected,
                        '&:hover': {
                            backgroundColor: excelColors.background.selected
                        }
                    }
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 2
                },
                contained: {
                    backgroundColor: excelColors.primary.main,
                    '&:hover': {
                        backgroundColor: excelColors.primary.dark
                    }
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 2
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 2,
                    border: `1px solid ${excelColors.border}`
                }
            }
        }
    },
    typography: {
        fontFamily: '"Segoe UI", "Calibri", sans-serif', // Excel standard fonter
        fontSize: 14
    }
}); 