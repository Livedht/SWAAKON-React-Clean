import { Container, Button, Typography } from '@mui/material';
import { styled } from '@mui/system';

export const StyledContainer = styled(Container)({
    paddingTop: '50px',
    textAlign: 'center',
});

export const StyledFooter = styled('footer')({
    padding: '20px 0',
    marginTop: 'auto',
    backgroundColor: '#0056b3',
    color: 'white',
    textAlign: 'center',
});

export const FormContainer = styled('div')({
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    transition: 'box-shadow 0.3s ease',
    '&:hover': {
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    },
    width: 'auto',
    maxWidth: '600px',
    minHeight: '250px',
    margin: 'auto',
    borderColor: '#1976D2',
    borderWidth: '2px',
    borderStyle: 'solid',
});

export const DownloadButton = styled(Button)({
    marginBottom: '20px',
    marginTop: '20px',
    transition: 'background-color 0.3s, transform 0.2s ease',
    '&:hover': {
        backgroundColor: '#217346',
        transform: 'translateY(-2px)',
        color: '#FFFFFF',
    },
});

export const ResultsContainer = styled('div')({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    marginTop: '20px',
    marginBottom: '40px',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
});

export const StyledTypography = styled(Typography)({
    marginBottom: '20px',
});

export const StyledButton = styled(Button)({
    marginRight: '10px',
    transition: 'background-color 0.3s, transform 0.2s ease',
    '&:hover': {
        backgroundColor: '#0056b3',
        transform: 'translateY(-2px)',
    },
});

export const ExportButton = styled(Button)({
    marginLeft: '10px',
    transition: 'background-color 0.3s, transform 0.2s ease',
    '&:hover': {
        backgroundColor: '#0056b3',
        transform: 'translateY(-2px)',
    },
});
