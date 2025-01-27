import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, IconButton, Typography, CircularProgress, Button, Fade, Snackbar, Alert } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CourseComparison from './components/CourseComparison';
import Login from './components/Login';
import { supabase, checkIsAdmin } from './services/supabase';
import AdminTools from './components/AdminTools';
import theme from './theme';
import UserInfo from './components/UserInfo';
import SearchHistory from './components/SearchHistory';
import { SearchProvider } from './context/SearchContext';

const App = () => {
    const [mode, setMode] = useState(localStorage.getItem('theme') || 'light');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAdmin] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentView, setCurrentView] = useState('main');
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [restoredSearch, setRestoredSearch] = useState(null);

    const showNotification = useCallback((message, severity = 'info') => {
        setNotification({ open: true, message, severity });
    }, []);

    const handleCloseNotification = useCallback(() => {
        setNotification(prev => ({ ...prev, open: false }));
    }, []);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            if (!localStorage.getItem('themeMode')) {
                setMode(e.matches ? 'dark' : 'light');
                showNotification('Theme updated to match system preferences', 'info');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [showNotification]);

    // Memoize the toggle function separately
    const toggleColorMode = useCallback(() => {
        setMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newMode);
            showNotification(`Theme switched to ${newMode} mode`);
            return newMode;
        });
    }, [showNotification]);

    // Then use it in the colorMode object
    const colorMode = useMemo(
        () => ({
            toggleColorMode
        }),
        [toggleColorMode]
    );

    // Memoize theme to prevent unnecessary recalculations
    const currentTheme = useMemo(
        () => createTheme({
            ...theme,
            palette: {
                mode,
                ...(mode === 'dark' ? {
                    background: {
                        default: '#121212',
                        paper: '#1e1e1e',
                    },
                    primary: {
                        main: '#90caf9',
                    },
                } : {
                    background: {
                        default: '#f5f5f5',
                        paper: '#ffffff',
                    },
                }),
            },
            components: {
                MuiButton: {
                    styleOverrides: {
                        root: {
                            borderRadius: 8,
                            textTransform: 'none',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                            },
                        },
                    },
                },
                MuiCard: {
                    styleOverrides: {
                        root: {
                            borderRadius: 12,
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                            },
                        },
                    },
                },
                MuiIconButton: {
                    styleOverrides: {
                        root: {
                            transition: 'transform 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'scale(1.1)',
                            },
                        },
                    },
                },
            },
        }),
        [mode]
    );

    // Memoize handlers
    const handleViewChange = useCallback((newView) => {
        setCurrentView(newView);
        showNotification(`Switched to ${newView === 'main' ? 'main view' : newView === 'history' ? 'search history' : 'admin panel'}`);
    }, [showNotification]);

    // Memoize auth check
    const checkUser = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            console.log('Logged in user:', user?.email);
        } catch (error) {
            console.error('Error checking auth status:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Memoize admin status check
    const checkAdminStatus = useCallback(async () => {
        if (user) {
            const adminStatus = await checkIsAdmin();
            console.log('Admin status:', adminStatus);
            setIsAdmin(adminStatus);
        }
    }, [user]);

    useEffect(() => {
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [checkUser]);

    useEffect(() => {
        checkAdminStatus();
    }, [checkAdminStatus]);

    // Memoize the header content
    const HeaderContent = useMemo(() => (
        <Box sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            px: 3,
            py: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        cursor: 'pointer'
                    }}
                    onClick={() => handleViewChange('main')}
                >
                    <img
                        src="/swaakon-logo.png"
                        alt="SWAAKON Logo"
                        style={{
                            height: '32px',
                            width: 'auto',
                            marginRight: '8px'
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            background: theme => theme.palette.mode === 'dark'
                                ? 'linear-gradient(45deg, #90caf9, #42a5f5)'
                                : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        SWAAKON
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        onClick={() => handleViewChange('main')}
                        variant={currentView === 'main' ? 'contained' : 'outlined'}
                        size="small"
                    >
                        Søk
                    </Button>
                    <Button
                        onClick={() => handleViewChange('history')}
                        variant={currentView === 'history' ? 'contained' : 'outlined'}
                        size="small"
                    >
                        Mine søk
                    </Button>
                    {isAdmin && (
                        <Button
                            onClick={() => handleViewChange('admin')}
                            variant={currentView === 'admin' ? 'contained' : 'outlined'}
                            size="small"
                        >
                            Admin Panel
                        </Button>
                    )}
                </Box>
                <IconButton
                    onClick={colorMode.toggleColorMode}
                    color="inherit"
                >
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
            </Box>

            {user && <UserInfo user={user} />}
        </Box>
    ), [colorMode.toggleColorMode, currentView, handleViewChange, isAdmin, mode, user]);

    if (loading) {
        return (
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100vh',
                        gap: 2
                    }}
                >
                    <CircularProgress size={48} />
                    <Typography variant="body1" color="text.secondary">
                        Loading SWAAKON...
                    </Typography>
                </Box>
            </ThemeProvider>
        );
    }

    if (!user) {
        return (
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <Fade in={true} timeout={800}>
                    <Box>
                        <Login onLogin={(user) => {
                            setUser(user);
                            showNotification('Successfully logged in', 'success');
                        }} />
                    </Box>
                </Fade>
            </ThemeProvider>
        );
    }

    console.log('Render state:', { isAdmin, showAdmin, userEmail: user?.email });

    return (
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <SearchProvider>
                <Box sx={{
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    transition: 'background-color 0.3s ease'
                }}>
                    {HeaderContent}
                    <Fade in={true} timeout={500}>
                        <Box sx={{
                            p: 2,
                            maxWidth: '1200px',
                            margin: '0 auto',
                            width: '100%'
                        }}>
                            {currentView === 'main' ? (
                                <CourseComparison
                                    restoredSearch={restoredSearch}
                                    onSearchComplete={() => setRestoredSearch(null)}
                                />
                            ) : currentView === 'history' ? (
                                <SearchHistory onRestoreSearch={(searchData) => {
                                    setRestoredSearch(searchData);
                                    setCurrentView('main');
                                    showNotification('Søk gjenopprettet', 'success');
                                }} />
                            ) : (
                                <AdminTools />
                            )}
                        </Box>
                    </Fade>
                </Box>
                <Snackbar
                    open={notification.open}
                    autoHideDuration={4000}
                    onClose={handleCloseNotification}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={handleCloseNotification}
                        severity={notification.severity}
                        sx={{
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {notification.message}
                    </Alert>
                </Snackbar>
            </SearchProvider>
        </ThemeProvider>
    );
};

export default App; 