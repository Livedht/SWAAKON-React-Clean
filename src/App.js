import React, { useState } from 'react';
import TestHF from './components/TestHF';
import { ThemeProvider } from '@mui/material/styles';
import { defaultTheme, darkTheme, excelTheme } from './theme';
import Navigation from './components/Navigation';

const App = () => {
    const [currentTheme, setCurrentTheme] = useState('default');

    const themes = {
        default: defaultTheme,
        dark: darkTheme,
        excel: excelTheme
    };

    return (
        <ThemeProvider theme={themes[currentTheme]}>
            <Navigation onThemeChange={setCurrentTheme} />
            <div className="App">
                <main>
                    <TestHF />
                </main>
            </div>
        </ThemeProvider>
    );
};

export default App; 