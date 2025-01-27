import React from 'react';
import { Box, Typography, Button, Avatar } from '@mui/material';
import { supabase } from '../services/supabase';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

const UserInfo = ({ user }) => {
    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 1,
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: 1
        }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
                <PersonIcon />
            </Avatar>
            <Typography variant="body2">
                {user?.email}
            </Typography>
            <Button
                size="small"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                variant="outlined"
            >
                Logg ut
            </Button>
        </Box>
    );
};

export default UserInfo; 