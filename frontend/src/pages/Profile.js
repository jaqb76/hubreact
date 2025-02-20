// src/pages/Profile.js
import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Avatar,
  Grid,
  Box,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Profil użytkownika
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mb: 3
                }}
              >
                <Avatar
                  src={user?.thumbnail_photo}
                  sx={{
                    width: 150,
                    height: 150,
                    mb: 2,
                    border: '3px solid #1976d2'
                  }}
                />
                <Typography variant="h5" gutterBottom>
                  {user?.displayName}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Informacje szczegółowe
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nazwa użytkownika
                  </Typography>
                  <Typography variant="body1">
                    {user?.username}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {user?.email}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Wyświetlana nazwa
                  </Typography>
                  <Typography variant="body1">
                    {user?.displayName}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Departament
                  </Typography>
                  <Typography variant="body1">
                    {user?.department || 'Nie określono'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile;
